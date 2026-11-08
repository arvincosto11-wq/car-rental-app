import express from 'express';
import User from '../models/User.js';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import Payout from '../models/Payout.js';
import { splitFor } from '../utils/revenueShare.js';
import {
  isPayable, payoutProblem, voidProblem, cleanReference, methodLabel,
} from '../utils/payouts.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser } from '../utils/notify.js';
import { fail } from '../utils/respond.js';

const router = express.Router();

const peso = (n) => `₱${Math.round(n || 0).toLocaleString('en-PH')}`;

// Every booking id already covered by a payout that still stands.
//
// Live payouts only: a voided one releases its trips back into what is
// owed, which is the whole point of voiding rather than deleting.
export const paidBookingIds = async (consignorIds) => {
  const payouts = await Payout.find({
    ...(consignorIds ? { consignor: { $in: consignorIds } } : {}),
    status: { $ne: 'void' },
  }).select('bookings').lean();

  const ids = new Set();
  for (const p of payouts) for (const b of p.bookings || []) ids.add(String(b));
  return ids;
};

// Everything recorded, newest first. Small enough to send whole: one row
// per payment ever made, and a payment is a rare event.
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const payouts = await Payout.find()
      .populate('consignor', 'name email phone')
      .populate('recordedBy', 'name')
      .populate('bookings', 'startDate endDate returnedAt subtotal totalPrice ownerShare car')
      .sort({ createdAt: -1 })
      .lean();
    res.json(payouts);
  } catch (err) {
    fail(res, err);
  }
});

// The owner's own payments.
router.get('/mine', protect, consignorOnly, async (req, res) => {
  try {
    const payouts = await Payout.find({ consignor: req.user.id })
      .populate('bookings', 'startDate endDate returnedAt subtotal totalPrice ownerShare car')
      .sort({ createdAt: -1 })
      .lean();
    res.json(payouts);
  } catch (err) {
    fail(res, err);
  }
});

// Record a payment that has already been sent.
//
// The browser says who was paid, which trips it settles and how the money
// travelled. It does NOT say how much: that is added up here from the
// trips, against the split each booking was agreed on. An amount posted
// by a client is a claim about money, and the trips are the record of it.
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { consignor: consignorId, bookings: bookingIds, method, reference, note, receipt } = req.body;

    const problem = payoutProblem({ method, reference, bookingIds });
    if (problem) return res.status(400).json({ message: problem });

    const consignor = await User.findById(consignorId).select('name role gcash');
    if (!consignor || consignor.role !== 'consignor') {
      return res.status(400).json({ message: 'That owner no longer has a consignor account.' });
    }

    // Their vehicles, so a trip on somebody else's car cannot be settled
    // against their name. Archived ones count: a vehicle leaving the
    // platform does not unmake the trips it already did, and those are
    // exactly the payments most likely to be outstanding.
    const cars = await Car.find({ owner: consignor._id }).select('_id').lean();
    const carIds = new Set(cars.map((c) => String(c._id)));

    const asked = [...new Set(bookingIds.map(String))];
    const bookings = await Booking.find({ _id: { $in: asked } })
      .select('car status subtotal totalPrice ownerShare startDate endDate returnedAt')
      .lean();

    if (bookings.length !== asked.length) {
      return res.status(400).json({ message: 'One of those trips no longer exists. Reload the page and try again.' });
    }

    for (const booking of bookings) {
      if (!carIds.has(String(booking.car))) {
        return res.status(400).json({ message: `One of those trips is not on a vehicle ${consignor.name} owns.` });
      }
      if (!isPayable(booking)) {
        return res.status(400).json({
          message: 'A trip can only be paid out once it has finished and the vehicle is back. Reload the page and try again.',
        });
      }
    }

    // The race this closes: two admins with the page open, both settling
    // the same trip. Checked against the database rather than against what
    // the browser was told when it loaded.
    const alreadyPaid = await paidBookingIds([consignor._id]);
    const clash = bookings.find((b) => alreadyPaid.has(String(b._id)));
    if (clash) {
      return res.status(409).json({
        message: 'One of those trips has already been paid out. Reload the page to see the current figures.',
      });
    }

    const amount = bookings.reduce((sum, b) => sum + splitFor(b).owner, 0);
    if (amount <= 0) {
      return res.status(400).json({ message: 'Those trips add up to nothing. There is no payment to record.' });
    }

    const payout = await Payout.create({
      consignor: consignor._id,
      amount,
      method,
      reference: method === 'cash' ? '' : cleanReference(reference),
      note: String(note || '').trim(),
      receipt: receipt?.url ? { url: receipt.url, fileId: receipt.fileId || '' } : undefined,
      bookings: bookings.map((b) => b._id),
      recordedBy: req.user.id,
    });

    // Worth an email as well as a notification: money has moved, and this
    // is the owner's chance to say it did not arrive.
    await notifyUser(
      consignor._id,
      'Payment recorded',
      `${peso(amount)} has been sent to you by ${methodLabel(method)} for ${bookings.length} trip${bookings.length === 1 ? '' : 's'}.`
        + ' Open your dashboard to check it arrived.',
      '/consignor',
      { email: true },
    );

    res.status(201).json(payout);
  } catch (err) {
    fail(res, err);
  }
});

// Void a payment. The row stays, the trips go back to owed.
router.put('/:id/void', protect, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const problem = voidProblem(reason);
    if (problem) return res.status(400).json({ message: problem });

    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ message: 'That payment is not on record.' });
    if (payout.status === 'void') {
      return res.status(400).json({ message: 'That payment has already been voided.' });
    }

    payout.status = 'void';
    payout.voidReason = String(reason).trim();
    payout.voidedAt = new Date();
    payout.voidedBy = req.user.id;
    await payout.save();

    await notifyUser(
      payout.consignor,
      'A payment was voided',
      `The ${peso(payout.amount)} payment recorded for you has been voided. Reason: ${payout.voidReason}.`
        + ' Those trips are owed to you again.',
      '/consignor',
      { email: true },
    );

    res.json(payout);
  } catch (err) {
    fail(res, err);
  }
});

// The owner saying the money arrived.
//
// Their own payments only, and only once: confirmation is a record of what
// they said, so it is not a toggle they can take back. If a confirmed
// payment turns out to be wrong, admin voids it and the reason is written
// down — which is the trail that is actually worth having.
router.put('/:id/confirm', protect, consignorOnly, async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ message: 'That payment is not on record.' });
    if (String(payout.consignor) !== String(req.user.id)) {
      return res.status(403).json({ message: 'That payment is not yours.' });
    }
    if (payout.status === 'void') {
      return res.status(400).json({ message: 'That payment was voided, so there is nothing to confirm.' });
    }
    if (payout.confirmedAt) return res.json(payout);

    payout.confirmedAt = new Date();
    await payout.save();
    res.json(payout);
  } catch (err) {
    fail(res, err);
  }
});

// Where an owner's money is sent.
//
// Admin writes it, not the owner — see the comment on the field in
// models/User.js. Stored as typed apart from trimming: GCash numbers get
// written with and without spaces and neither is wrong.
router.put('/details/:consignorId', protect, adminOnly, async (req, res) => {
  try {
    const { number, name } = req.body;
    const consignor = await User.findById(req.params.consignorId).select('name role gcash');
    if (!consignor || consignor.role !== 'consignor') {
      return res.status(404).json({ message: 'No consignor with that account.' });
    }

    const digits = String(number ?? '').replace(/\D/g, '');
    if (digits && digits.length < 10) {
      return res.status(400).json({ message: 'That does not look like a mobile number.' });
    }

    consignor.gcash = {
      number: String(number ?? '').trim(),
      name: String(name ?? '').trim(),
    };
    await consignor.save();
    res.json({ gcash: consignor.gcash });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
