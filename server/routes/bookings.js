import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import LongRentalDiscount from '../models/LongRentalDiscount.js';
import User from '../models/User.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';
import { refundBookingPayment } from '../utils/paymongo.js';
import { computeBookingPrice } from '../utils/promo.js';
import { remindStalePendingBookings } from '../utils/pendingReminders.js';
import { openAdjustOffer, acceptAdjustOffer, startTopUp, confirmTopUp, declineAdjustOffer, expireAdjustOffers } from '../utils/adjustOffer.js';
import { cancelBookingWithRefund, getRefundPercentage, CANCEL_REASONS } from '../utils/cancelBooking.js';
import { busySpans, firstConflict, bookingSpan } from '../utils/availability.js';
import { latestPossibleEnd, quoteExtension, startExtension, confirmExtension, hasCollectedVehicle } from '../utils/extendBooking.js';
import { instantFrom, isTradingHour, daysBetween, dayAlignedSpan, phDayStart, phHour, formatMoment } from '../utils/phTime.js';

const router = express.Router();

// How long after the pickup time a no-show can still be recorded. Mirrored
// in ManageBookings on the client, which hides the button on the same rule;
// this is the one that actually decides.
const NO_SHOW_WINDOW_HOURS = 24;

async function recomputeCarRating(carId) {
  const [result] = await Booking.aggregate([
    { $match: { car: new mongoose.Types.ObjectId(carId), 'carRating.overall': { $exists: true }, 'carRating.hidden': { $ne: true } } },
    { $group: { _id: null, avg: { $avg: '$carRating.overall' }, count: { $sum: 1 } } }
  ]);
  await Car.findByIdAndUpdate(carId, {
    avgRating: result ? Math.round(result.avg * 10) / 10 : 0,
    ratingCount: result ? result.count : 0,
  });
}

// A confirmed booking is auto-completed the day after its return date, so
// clients can rate their trip and consignors get credited without an admin
// having to remember to click "Mark as Returned". Early returns still go
// through the manual admin action.
async function autoCompleteExpiredBookings() {
  // Measured against the start of today in Legazpi, not in UTC — with real
  // return times a UTC boundary would complete a morning return eight hours
  // after the client handed the keys back, on the same day.
  const startOfToday = phDayStart(new Date());

  const expired = await Booking.find({ status: 'confirmed', endDate: { $lt: startOfToday } });
  for (const booking of expired) {
    booking.status = 'completed';
    await booking.save();
    await notifyUser(booking.user, 'Vehicle Returned', 'Your vehicle return has been recorded. You can now rate your experience.', '/my-bookings/rate');
  }
}

async function recomputeClientRating(userId) {
  const [result] = await Booking.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), 'clientRating.rating': { $exists: true } } },
    { $group: { _id: null, avg: { $avg: '$clientRating.rating' }, count: { $sum: 1 } } }
  ]);
  await User.findByIdAndUpdate(userId, {
    avgRating: result ? Math.round(result.avg * 10) / 10 : 0,
    ratingCount: result ? result.count : 0,
  });
}

// Date-range overlap check: does `car` already have a booking in one of
// Is this vehicle free for [start, end)? Returns whatever is in the way, or
// null, with `kind` saying whether it's another booking or a blocked range —
// the two mean different things to a client.
//
// Only CONFIRMED bookings are treated as a hard block for other clients: a
// pending request never blocks anyone else's, it just risks losing the race
// when one of them gets confirmed (see the offer-or-refund logic below,
// which is the actual arbiter). Blocked ranges count only once approved — a
// consignor's request has no effect until an admin signs off.
//
// The real work lives in utils/availability.js, which also adds each
// booking's turnaround and repairs the eight-hour drift on anything saved
// before pickup times existed.
async function findConflict(carId, start, end, statuses = ['confirmed'], excludeBookingId) {
  const { spans } = await busySpans(carId, { statuses, excludeBookingId });
  return firstConflict({ start: new Date(start), end: new Date(end) }, spans);
}

// Create booking
router.post('/', protect, async (req, res) => {
    try {
    const { carId, startDate, endDate, paymentType, bookingType, paymentMethod } = req.body;

    const currentUser = await User.findById(req.user.id);
    if (currentUser?.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked from making bookings. Please contact support.' });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    if (!car.isAvailable) {
      return res.status(400).json({ message: 'This vehicle is not currently listed for booking.' });
    }

    const requestedType = bookingType || 'with-driver';
    const supportedTypes = car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'];
    if (!supportedTypes.includes(requestedType)) {
      return res.status(400).json({ message: `This vehicle does not offer ${requestedType === 'self-drive' ? 'self-drive' : 'with-driver'} bookings.` });
    }

    // A pickup hour makes these real moments in Legazpi rather than the old
    // date-only form. It's optional so a browser still running the previous
    // build keeps working exactly as it did — those bookings simply carry no
    // time, and hasPickupTime records which kind this is.
    const pickupHour = Number(req.body.pickupHour);
    const hasPickupTime = isTradingHour(pickupHour);
    if (req.body.pickupHour !== undefined && req.body.pickupHour !== null && !hasPickupTime) {
      return res.status(400).json({ message: 'Please choose a pickup time between 7:00 AM and 8:00 PM.' });
    }

    const requestedStart = hasPickupTime ? instantFrom(startDate, pickupHour) : new Date(startDate);
    const requestedEnd = hasPickupTime ? instantFrom(endDate, pickupHour) : new Date(endDate);
    // What the vehicle is actually occupied for. A date-only booking means
    // whole calendar days in Legazpi, not UTC midnights.
    const requestedSpan = hasPickupTime
      ? { start: requestedStart, end: requestedEnd }
      : dayAlignedSpan(requestedStart, requestedEnd);

    // Only enforced on bookings that carry a time — a date-only one has no
    // hour to compare, and "today" has always been bookable.
    if (hasPickupTime && requestedStart <= new Date()) {
      return res.status(400).json({ message: 'That pickup time has already passed. Please choose another.' });
    }

    // Don't let the same client double-submit for dates they've already
    // requested/booked on this car.
    const ownExisting = await Booking.findOne({
      user: req.user.id, car: carId, status: { $in: ['pending', 'confirmed'] },
      startDate: { $lt: requestedEnd }, endDate: { $gt: requestedStart },
    });
    if (ownExisting) {
      return res.status(400).json({ message: 'You already have an active booking request for this car during these dates.' });
    }

    // Only a CONFIRMED booking actually blocks the dates for everyone else —
    // pending requests from other clients don't, so multiple people can
    // request the same dates and the first one an admin confirms wins (the
    // others get auto-refunded, see PUT /:id below).
    const conflict = await findConflict(carId, requestedSpan.start, requestedSpan.end);
    if (conflict) {
      return res.status(400).json({
        message: conflict.kind === 'block'
          ? 'This vehicle is not available during the selected dates. Please choose different dates.'
          : 'This vehicle is already booked around the selected dates and times. Please choose another slot.',
      });
    }

    // A verified, unexpired ID is required for EVERY booking type — identity
    // still matters even when a driver is provided, not just for self-drive.
    // idVerified (set by admin after reviewing the photo) is the real gate,
    // since the expiry date alone could be fabricated. Managed from the
    // client's own Profile, never accepted inline here.
    if (!currentUser.validIdImage) {
      return res.status(400).json({ message: 'Please upload a photo of your valid ID in your Profile before booking.' });
    }
    if (!currentUser.idVerified) {
      return res.status(400).json({ message: 'Your ID is still pending verification by our team. You can book once it is approved.' });
    }
    if (currentUser.validIdExpiry && new Date(currentUser.validIdExpiry) < new Date()) {
      return res.status(400).json({ message: 'Your valid ID has expired. Please update it in your Profile before booking.' });
    }

    // Self-drive additionally requires a valid, unexpired driver's license —
    // with-driver bookings don't, since the renter isn't the one driving.
    if (bookingType === 'self-drive') {
      if (!currentUser.licenseNumber || !currentUser.licenseExpiry) {
        return res.status(400).json({ message: "A driver's license is required to book self-drive. Please add it in your Profile." });
      }
      if (new Date(currentUser.licenseExpiry) < new Date()) {
        return res.status(400).json({ message: "Your driver's license has expired. Please update it in your Profile." });
      }
    }

    const start = requestedStart;
    const end = requestedEnd;
    // Unchanged by the hour: the return is always the same time as the
    // pickup, so a day is always exactly a day.
    const totalDays = daysBetween(start, end);

    // Price and amount due are computed server-side from the car's real
    // price, never trusted from the client — otherwise a tampered request
    // could set amountPaid to whatever it wants and still get a "paid"
    // booking through GCash for a fraction of the real cost.
    // Any promo discount is applied here too, so a tampered request can't
    // claim one it doesn't qualify for. The promo is copied onto the booking
    // rather than read back off the car later — the car's promo can be
    // edited or cleared at any time, this receipt can't change.
    // Long-rental rules are read fresh at booking time, so an "all vehicles"
    // rule also covers cars added after it was created.
    const longRentalRules = await LongRentalDiscount.find({ active: true }).lean();
    const { subtotal, discountAmount, totalPrice: computedTotalPrice, promoLabel } =
      computeBookingPrice(car, totalDays, start, end, longRentalRules);
    const validPaymentType = paymentType === 'full' ? 'full' : 'downpayment';
    const computedAmountPaid = validPaymentType === 'full' ? computedTotalPrice : Math.ceil(computedTotalPrice * 0.20);

    const booking = await Booking.create({
      user: req.user.id,
      car: carId,
      startDate: start,
      endDate: end,
      hasPickupTime,
      totalDays,
      totalPrice: computedTotalPrice,
      subtotal,
      discountAmount,
      promoLabel,
      amountPaid: computedAmountPaid,
      paymentType: validPaymentType,
      bookingType: bookingType || 'with-driver',
      payment: paymentMethod === 'gcash' ? 'gcash_pending' : (validPaymentType === 'full' ? 'paid' : 'offline')
    });

    // Admin isn't notified yet here — Manage Bookings only shows paid
    // bookings, so pinging admin about one that might never even get paid
    // for would just point them at something they can't find. The
    // notification fires once payment actually succeeds instead — see
    // reconcileBookingPayment in routes/payments.js.

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get logged-in user's bookings
router.get('/my', protect, async (req, res) => {
  try {
    await autoCompleteExpiredBookings();
    await remindStalePendingBookings();
    await expireAdjustOffers();
    // Plate number is confidential — clients never see it, not even in the
    // raw response, so it can't be read off the network tab either.
    const bookings = await Booking.find({ user: req.user.id })
      .populate('car', '-plateNumber')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all bookings (admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    await autoCompleteExpiredBookings();
    await remindStalePendingBookings();
    await expireAdjustOffers();
    const bookings = await Booking.find()
      .populate('car')
      .populate('user', 'name email avgRating ratingCount')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get booking history for cars owned by the logged-in consignor (read-only —
// consignors can track bookings but cannot approve/decline them)
router.get('/owner', protect, consignorOnly, async (req, res) => {
  try {
    await autoCompleteExpiredBookings();
    await remindStalePendingBookings();
    await expireAdjustOffers();
    const cars = await Car.find({ owner: req.user.id }).select('_id');
    const carIds = cars.map((c) => c._id);
    const bookings = await Booking.find({ car: { $in: carIds } })
      .populate('car')
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update booking status (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const previousStatus = booking.status;

    // Only forward transitions are allowed here — reverting a booking (e.g.
    // sending 'pending' for an already-confirmed one) would skip the
    // payment/overlap guards below that only run on the way INTO a status,
    // not out of it. completed/cancelled are terminal.
    const ALLOWED_TRANSITIONS = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['cancelled', 'completed'],
    };
    if (status !== previousStatus && !(ALLOWED_TRANSITIONS[previousStatus] || []).includes(status)) {
      return res.status(400).json({ message: `This booking's status cannot be changed from ${previousStatus} to ${status}.` });
    }

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      if (booking.payment !== 'paid') {
        return res.status(400).json({ message: 'This booking cannot be confirmed until the GCash payment is completed.' });
      }
      // The client is mid-decision between new dates and a refund, so these
      // dates aren't theirs to be confirmed on any more.
      if (booking.adjustOffer?.status === 'open') {
        return res.status(400).json({ message: 'This client is choosing between new dates and a refund. You can confirm it once they have answered.' });
      }

      const car = await Car.findById(booking.car);
      if (!car) return res.status(404).json({ message: 'Car not found' });

      // Re-check for a conflicting CONFIRMED booking right before committing —
      // this is the actual guard against double-booking now that availability
      // is per-date-range instead of one blanket flag on the car.
      // Catches an admin-blocked range as well as another reservation — the
      // admin may have blocked this range after the client's request came in.
      const conflict = await findConflict(booking.car, bookingSpan(booking).start, bookingSpan(booking).end, ['confirmed'], booking._id);
      const blockedRange = conflict?.kind === 'block';

      if (conflict) {
        // Another booking already claimed overlapping dates, or the admin
        // blocked them. Don't allow this one to be confirmed too — send it
        // straight to an approved refund instead. This is the platform's
        // fault, not the client's choice to cancel, so it's always a full
        // refund regardless of pickup timing. The vehicle genuinely isn't
        // available either way, so this cancels regardless of whether the
        // real GCash refund below succeeds — a failure there just gets
        // flagged for admin to handle manually.
        booking.status = 'cancelled';
        booking.refundStatus = 'approved';
        booking.refundReason = blockedRange
          ? 'Automatically refunded: this vehicle is blocked for these dates.'
          : 'Automatically refunded: this vehicle was already booked for overlapping dates by another confirmed reservation.';
        booking.refundAmount = booking.amountPaid;
        if (booking.payment === 'gcash_pending') booking.payment = 'offline';
        try {
          await refundBookingPayment(booking);
        } catch (err) {
          console.error('Auto-refund failed for booking', booking._id.toString(), err.message);
          await notifyAdmins('Manual Refund Needed', `Automatic GCash refund failed for a cancelled booking — please refund ₱${booking.amountPaid.toLocaleString()} manually.`, '/admin/manage-bookings');
        }
        await booking.save();

        const clientMessage = blockedRange
          ? 'Your booking request could not be confirmed because the vehicle is blocked for those dates. It has been cancelled and automatically approved for a refund.'
          : 'Your booking request could not be confirmed because the vehicle was already booked for those dates. It has been cancelled and automatically approved for a refund.';
        // Money moving the other way, on a booking they thought they had.
        await notifyUser(booking.user, 'Booking Cancelled & Refunded', clientMessage, '/my-bookings', { email: true });

        return res.json({
          ...booking.toObject(),
          autoRefunded: true,
          message: blockedRange
            ? 'This vehicle is blocked for some of the selected dates. The request has been cancelled and automatically approved for refund.'
            : 'This vehicle was already booked for overlapping dates by another client. The request has been cancelled and automatically approved for refund.'
        });
      }

      booking.status = status;
      await booking.save();

      // Any other PENDING request for this car that overlaps these same dates
      // has lost the race — auto-cancel and refund it in full (platform's
      // fault, not the client's). Pending requests for non-overlapping dates
      // are untouched. Looped (not a bulk updateMany) so each one's real
      // GCash charge can actually be reversed through PayMongo.
      const overlappingPending = await Booking.find({
        car: booking.car, _id: { $ne: booking._id }, status: 'pending',
        startDate: { $lt: booking.endDate }, endDate: { $gt: booking.startDate },
      });
      for (const pending of overlappingPending) {
        // Losing the race no longer means being cancelled outright. Each
        // client is offered the nearest dates we can actually honour,
        // against a full refund, and has until the offer's deadline to
        // choose — see utils/adjustOffer.js. Falling through to the old
        // cancel-and-refund below only happens when there is genuinely
        // nothing to offer: too close to pickup, or nothing free nearby.
        if (await openAdjustOffer(pending, { reason: 'booking_conflict' })) continue;

        pending.status = 'cancelled';
        pending.refundStatus = 'approved';
        pending.refundReason = 'Automatically refunded: another booking for overlapping dates was confirmed first.';
        pending.refundAmount = pending.amountPaid;
        if (pending.payment === 'gcash_pending') pending.payment = 'offline';
        try {
          await refundBookingPayment(pending);
        } catch (err) {
          console.error('Auto-refund failed for booking', pending._id.toString(), err.message);
          await notifyAdmins('Manual Refund Needed', `Automatic GCash refund failed for a cancelled booking — please refund ₱${pending.amountPaid.toLocaleString()} manually.`, '/admin/manage-bookings');
        }
        await pending.save();
      }

      const longDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const pickupStr = formatMoment(booking.startDate, booking.hasPickupTime, longDate);
      const returnStr = formatMoment(booking.endDate, booking.hasPickupTime, longDate);
      const pickupReminder = booking.bookingType === 'self-drive'
        ? "Bring a valid ID and your driver's license to pick up the vehicle."
        : 'Your driver will meet you at the pickup location.';
      // Emailed as well as shown in the bell: the client has been waiting
      // on this answer, and it carries the pickup time they need.
      await notifyUser(
        booking.user,
        'Booking Confirmed',
        `Your ${car.brand} ${car.model} booking is confirmed. Pickup: ${pickupStr}. Return: ${returnStr}. ${pickupReminder}`,
        '/my-bookings',
        { email: true }
      );
      if (car.owner) {
        await notifyUser(car.owner, 'Vehicle Booked', `Your vehicle ${car.brand} ${car.model} has a new confirmed booking.`, '/consignor');
      }

      return res.json(booking);
    }

    // Can't return a vehicle that hasn't even been picked up yet — this is
    // "Mark as Returned" for an early return, not a way to skip ahead.
    if (status === 'completed' && previousStatus !== 'completed') {
      if (new Date() < new Date(booking.startDate)) {
        return res.status(400).json({ message: 'This booking cannot be marked as returned before its pickup date.' });
      }
    }

    // Cancelling used to just flip the status and notify — no refund record,
    // no money returned. A client whose booking admin cancelled simply lost
    // what they'd paid. The reason now decides the refund, and the whole
    // thing goes through one helper shared with the blocked-dates sweep.
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      const { cancelReason, cancelNote } = req.body;
      if (!CANCEL_REASONS.includes(cancelReason)) {
        return res.status(400).json({ message: 'Please say why this booking is being cancelled.' });
      }
      await cancelBookingWithRefund(booking, {
        reason: cancelReason,
        clientNote: cancelNote || '',
      });
      return res.json(booking);
    }

    booking.status = status;
    await booking.save();
    if (status === 'completed' && previousStatus !== 'completed') {
      await notifyUser(booking.user, 'Vehicle Returned', 'Your vehicle return has been recorded. You can now rate your experience.', '/my-bookings/rate');
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin records the remaining balance as collected in person at pickup
// (cash or GCash) — the only thing left owed on a downpayment booking. No
// new field needed: once amountPaid reaches totalPrice, there's nothing
// left to collect, so that alone is the "settled" signal everywhere else
// (Manage Bookings, My Bookings) already reads from.
router.put('/:id/collect-balance', protect, adminOnly, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Deliberately not gated on paymentType. A booking paid in full can
    // still end up owing something: accepting alternative dates that a
    // promo doesn't reach raises the total, and the difference falls due at
    // pickup like any other balance. Refusing it here left admin looking at
    // a "Mark Balance Received" button that could never work. Whether
    // anything is actually owed is the next check's job, and it answers it
    // for every booking the same way.
    if (booking.amountPaid >= booking.totalPrice) {
      return res.status(400).json({ message: 'There is no remaining balance on this booking.' });
    }

    const collected = booking.totalPrice - booking.amountPaid;
    booking.amountPaid = booking.totalPrice;
    await booking.save();

    await notifyUser(booking.user, 'Balance Received', `We've recorded your remaining balance of ₱${collected.toLocaleString()} as paid. Thanks!`, '/my-bookings');

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin marks a confirmed booking as a no-show once its pickup date has
// passed — cancels it (freeing the car for other bookings, same as any
// other cancelled booking) and forfeits whatever the client already paid
// as a no-show fee instead of running it through the normal refund-request
// flow. Reuses refundStatus/refundReason/refundAmount to record that
// outcome rather than adding a dedicated field — a no-show is really just
// a cancellation with $0 refund and a specific reason.
router.put('/:id/no-show', protect, adminOnly, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Only a confirmed booking can be marked as a no-show.' });
    }
    if (new Date() < new Date(booking.startDate)) {
      return res.status(400).json({ message: "This booking can't be marked as a no-show before its pickup date." });
    }
    // A no-show means the vehicle was never collected, and it forfeits
    // everything the client paid. Extending a booking is proof they did
    // collect it, so this must not be reachable afterwards — it is one
    // misclick from taking somebody's money for a trip they are on.
    if (booking.extensions?.length) {
      return res.status(400).json({ message: 'This booking was extended, so the vehicle was collected. Cancel it instead if something has gone wrong.' });
    }
    // And it is something you discover on the day. Three days into a trip
    // it is not a no-show, whatever else it might be.
    if (new Date() > new Date(new Date(booking.startDate).getTime() + NO_SHOW_WINDOW_HOURS * 60 * 60 * 1000)) {
      return res.status(400).json({ message: `A no-show can only be recorded within ${NO_SHOW_WINDOW_HOURS} hours of the pickup time. Cancel the booking instead.` });
    }

    booking.status = 'cancelled';
    booking.refundStatus = 'declined';
    booking.refundReason = 'Client did not show up for pickup — the amount paid is forfeited as a no-show fee, per booking terms.';
    booking.refundAmount = 0;
    await booking.save();

    await notifyUser(
      booking.user,
      'Booking Marked as No-Show',
      'Your booking was cancelled because the vehicle was not picked up. The amount you paid has been forfeited as a no-show fee, per our booking terms.',
      '/my-bookings',
      // Their money is gone. A line in a notification bell they may never
      // open is not enough notice of that.
      { email: true }
    );

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Refund tiers based on how long ago the booking was MADE — not the pickup
// date at all. A short cooling-off window (full refund) for a quick change
// of mind, tapering off the longer the client sits on the booking before
// cancelling. Computed at request time, not when an admin eventually gets
// to it, so a slow approval can't quietly shrink what the client was
// promised.
// Client requests a refund
router.post('/:id/refund', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking is not eligible for a refund.' });
    }
    // Nothing was ever taken, so there is nothing to give back — and a
    // request against an unpaid booking lands in a queue admin cannot see,
    // because Manage Bookings only lists paid ones.
    if (booking.payment !== 'paid') {
      return res.status(400).json({ message: 'This booking has not been paid for, so there is nothing to refund.' });
    }
    if (booking.refundStatus !== 'none') {
      return res.status(400).json({ message: 'A refund request already exists for this booking.' });
    }

    const percentage = getRefundPercentage(booking.createdAt);
    booking.refundStatus = 'requested';
    booking.refundReason = reason;
    booking.refundAmount = Math.round(booking.amountPaid * (percentage / 100));
    await booking.save();

    await notifyAdmins('New Refund Request', 'A client has requested a refund for a booking.', '/admin/manage-bookings');

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// A client changing their mind about a request they made themselves.
//
// Cleared rather than marked declined. A decline is the business turning
// somebody down, and leaving that on a booking the client withdrew would
// misrepresent what happened — to them, and to whoever reads it later.
//
// Only while it is still theirs to withdraw: re-checked here, so a client
// and an admin acting in the same moment can't both win.
router.delete('/:id/refund', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.refundStatus !== 'requested') {
      return res.status(400).json({ message: 'This refund request has already been dealt with.' });
    }

    booking.refundStatus = 'none';
    booking.refundReason = '';
    // Cleared deliberately. It was locked in at the moment they asked,
    // priced on how long ago they booked — holding onto it would promise
    // an amount that may no longer be what the policy gives them.
    booking.refundAmount = 0;
    await booking.save();

    await notifyAdmins('Refund Request Withdrawn', 'A client has withdrawn their refund request.', '/admin/manage-bookings');
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// The same for a reschedule. Nothing is locked in here, so withdrawing one
// costs the client nothing.
router.delete('/:id/reschedule', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.rescheduleRequest?.status !== 'pending') {
      return res.status(400).json({ message: 'This reschedule request has already been dealt with.' });
    }

    booking.rescheduleRequest = { status: 'none', reason: '', adminNotes: '' };
    await booking.save();

    await notifyAdmins('Reschedule Request Withdrawn', 'A client has withdrawn their reschedule request.', '/admin/manage-bookings');
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines a refund request
router.put('/:id/refund', protect, adminOnly, async (req, res) => {
  try {
    const { decision } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.refundStatus !== 'requested') {
      return res.status(400).json({ message: 'No pending refund request for this booking.' });
    }

    if (decision === 'approved') {
      // Actually reverse the GCash charge through PayMongo — approving here
      // used to just flip a status flag, but now that GCash is a real
      // payment, this needs to move real money back. If it fails, don't
      // cancel the booking or mark it refunded — surface the error so
      // admin can retry rather than silently promising a refund that
      // never happened.
      try {
        await refundBookingPayment(booking);
      } catch (err) {
        return res.status(502).json({ message: `Could not process the GCash refund automatically: ${err.message}. Nothing was changed — please retry.` });
      }
      booking.status = 'cancelled';
      if (booking.payment === 'gcash_pending') {
        // Never actually paid — refundBookingPayment no-op'd (nothing to
        // reverse), and it shouldn't keep showing "GCash Pending" now dead.
        booking.payment = 'offline';
      }
    }

    booking.refundStatus = decision;
    await booking.save();

    if (decision === 'approved') {
      await notifyUser(booking.user, 'Refund Approved', `Your refund of ₱${booking.refundAmount.toLocaleString()} has been approved.`, '/my-bookings', { email: true });
    } else if (decision === 'declined') {
      await notifyUser(booking.user, 'Refund Declined', 'Your refund request has been declined.', '/my-bookings', { email: true });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Client requests to move their trip to different dates without cancelling.
// Kept to the same trip length (no partial refund / extra charge to work
// out) — the point is shifting when the trip happens, not changing its size.
router.post('/:id/reschedule', protect, async (req, res) => {
  try {
    const { newStartDate, newEndDate, reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking is not eligible for a reschedule.' });
    }
    // Same reason as the refund above: admin never sees an unpaid booking,
    // so a request on one would sit forever with nobody able to answer it.
    if (booking.payment !== 'paid') {
      return res.status(400).json({ message: 'Please complete your payment before rescheduling this booking.' });
    }
    if (booking.refundStatus !== 'none') {
      return res.status(400).json({ message: 'This booking already has a refund request in progress.' });
    }
    if (booking.rescheduleRequest?.status === 'pending') {
      return res.status(400).json({ message: 'You already have a pending reschedule request for this booking.' });
    }
    // These dates aren't available any more — that's the whole reason the
    // offer is open — so a reschedule request against them means nothing.
    if (booking.adjustOffer?.status === 'open') {
      return res.status(400).json({ message: 'Please choose new dates or a refund on this booking first.' });
    }

    // A reschedule moves the dates and may move the hour with them. The
    // trip keeps its LENGTH, which is what holds the price still — the
    // hour costs nothing to change and refusing to change it turned
    // clients away from days where only their old hour was taken.
    //
    // A booking made before pickup times existed stays a whole-day
    // booking rather than growing an hour it was never made with.
    const wantedHour = Number(req.body.pickupHour);
    if (booking.hasPickupTime && req.body.pickupHour !== undefined && req.body.pickupHour !== null && !isTradingHour(wantedHour)) {
      return res.status(400).json({ message: 'Please choose a pickup time between 7:00 AM and 8:00 PM.' });
    }
    const keptHour = booking.hasPickupTime
      ? (isTradingHour(wantedHour) ? wantedHour : phHour(booking.startDate))
      : null;
    const start = keptHour === null ? new Date(newStartDate) : instantFrom(newStartDate, keptHour);
    const end = keptHour === null ? new Date(newEndDate) : instantFrom(newEndDate, keptHour);
    if (!newStartDate || !newEndDate || isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ message: 'Please provide a valid date range.' });
    }
    if (start < new Date()) {
      return res.status(400).json({ message: 'The new pickup date must be in the future.' });
    }
    const newDays = daysBetween(start, end);
    if (newDays !== booking.totalDays) {
      return res.status(400).json({ message: `Reschedule must keep the same trip length (${booking.totalDays} day${booking.totalDays === 1 ? '' : 's'}). Cancel and rebook instead if you need a different duration.` });
    }
    if (start.getTime() === new Date(booking.startDate).getTime() && end.getTime() === new Date(booking.endDate).getTime()) {
      return res.status(400).json({ message: 'Those are already this booking\'s current dates.' });
    }

    const conflict = await findConflict(booking.car, start, end, ['confirmed'], booking._id);
    if (conflict) {
      return res.status(400).json({
        message: conflict.kind === 'block'
          ? 'This vehicle is not available during those dates. Please choose a different range.'
          : 'This vehicle is already booked around those dates and times. Please choose a different range.',
      });
    }

    booking.rescheduleRequest = {
      status: 'pending', newStartDate: start, newEndDate: end,
      reason: reason || '', adminNotes: '', requestedAt: new Date(),
    };
    await booking.save();

    await notifyAdmins('New Reschedule Request', 'A client has requested to reschedule a booking.', '/admin/manage-bookings');

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines a reschedule request
router.put('/:id/reschedule', protect, adminOnly, async (req, res) => {
  try {
    const { decision, adminNotes } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.rescheduleRequest?.status !== 'pending') {
      return res.status(400).json({ message: 'No pending reschedule request for this booking.' });
    }
    // The client is already being asked to pick new dates for this booking.
    // Approving an older reschedule request now would move them twice.
    if (booking.adjustOffer?.status === 'open') {
      return res.status(400).json({ message: 'This client is choosing new dates or a refund. Wait until they have answered.' });
    }

    if (decision === 'approved') {
      // Re-check right before committing — dates could have been claimed by
      // another confirmed booking (or blocked by admin) since the client's
      // original request.
      const conflict = await findConflict(booking.car, booking.rescheduleRequest.newStartDate, booking.rescheduleRequest.newEndDate, ['confirmed'], booking._id);
      if (conflict) {
        booking.rescheduleRequest.status = 'declined';
        booking.rescheduleRequest.adminNotes = conflict.kind === 'block'
          ? 'Automatically declined: those dates are blocked.'
          : 'Automatically declined: those dates were booked by someone else in the meantime.';
        await booking.save();
        await notifyUser(booking.user, 'Reschedule Declined', 'Your reschedule request could not be approved because those dates are no longer available. Your original dates are unchanged.', '/my-bookings', { email: true });
        return res.json(booking);
      }

      booking.startDate = booking.rescheduleRequest.newStartDate;
      booking.endDate = booking.rescheduleRequest.newEndDate;
      booking.rescheduleRequest.status = 'approved';
      await booking.save();
      await notifyUser(booking.user, 'Reschedule Approved', 'Your booking has been moved to the new dates you requested.', '/my-bookings', { email: true });

      const car = await Car.findById(booking.car).select('brand model owner');
      if (car?.owner) {
        await notifyUser(car.owner, 'Booking Rescheduled', `A booking for your vehicle ${car.brand} ${car.model} was moved to new dates.`, '/consignor');
      }
    } else {
      booking.rescheduleRequest.status = 'declined';
      booking.rescheduleRequest.adminNotes = adminNotes || '';
      await booking.save();
      await notifyUser(booking.user, 'Reschedule Declined', `Your reschedule request was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}`, '/my-bookings', { email: true });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Client rates the car/service after the vehicle has been returned
router.post('/:id/rate-car', protect, async (req, res) => {
  try {
    const { vehicleCondition, serviceQuality, cleanliness, comment, photos } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'You can only rate this booking after the vehicle has been returned.' });
    }
    for (const val of [vehicleCondition, serviceQuality, cleanliness]) {
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return res.status(400).json({ message: 'All ratings must be a whole number between 1 and 5.' });
      }
    }

    const overall = Math.round(((vehicleCondition + serviceQuality + cleanliness) / 3) * 10) / 10;
    const ratedAt = booking.carRating?.ratedAt || new Date();
    // Preserve any existing moderation state across a client's edit to their
    // own rating — editing shouldn't silently un-hide a review admin removed.
    const hidden = booking.carRating?.hidden || false;

    booking.carRating = {
      vehicleCondition, serviceQuality, cleanliness, overall,
      comment: comment || '', photos: Array.isArray(photos) ? photos : [], hidden,
      ratedAt, updatedAt: new Date(),
    };
    await booking.save();
    await recomputeCarRating(booking.car);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin hides or unhides a client's car review (moderation) — hidden
// reviews stay in the database but drop out of the public reviews list
// and the car's average rating.
router.put('/:id/rate-car/moderate', protect, adminOnly, async (req, res) => {
  try {
    const { hidden } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.carRating?.ratedAt) {
      return res.status(400).json({ message: 'This booking has no review to moderate.' });
    }

    const wasHidden = booking.carRating.hidden;
    booking.carRating.hidden = !!hidden;
    await booking.save();
    await recomputeCarRating(booking.car);

    if (!!hidden && !wasHidden) {
      const car = await Car.findById(booking.car).select('brand model');
      await notifyUser(
        booking.user,
        'Your review was removed',
        `Your review${car ? ` for ${car.brand} ${car.model}` : ''} was removed by an admin for not meeting our guidelines.`,
        '/my-bookings'
      );
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin rates the client after the vehicle has been returned
router.post('/:id/rate-client', protect, adminOnly, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'You can only rate this client after the vehicle has been returned.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5.' });
    }

    const ratedAt = booking.clientRating?.ratedAt || new Date();

    booking.clientRating = { rating, comment: comment || '', ratedAt, updatedAt: new Date() };
    await booking.save();
    await recomputeClientRating(booking.user);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// The client answers an offer of alternative dates: take one, or take the
// refund. Deliberately the client's own call — the whole point of the offer
// is that admin doesn't decide this for them. An offer past its deadline is
// refused here rather than honoured late, since the expiry sweep may not
// have reached it yet and both paths must agree.
router.put('/:id/adjust', protect, async (req, res) => {
  try {
    const { decision, optionIndex } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    // Deliberately not bookingAwaitingDecision here: that folds the deadline
    // in, and a client who arrives seconds late deserves to be told what
    // actually happened rather than "nothing to decide".
    const live = booking.status === 'pending' || booking.status === 'confirmed';
    if (!live || booking.adjustOffer?.status !== 'open') {
      return res.status(400).json({ message: 'There is nothing to decide on this booking.' });
    }
    if (new Date(booking.adjustOffer.deadline) <= new Date()) {
      await expireAdjustOffers();
      return res.status(400).json({ message: 'The deadline for this booking has passed, so it has been refunded in full.' });
    }

    if (decision === 'refund') {
      const amount = await declineAdjustOffer(booking);
      return res.json({ ...booking.toObject(), refunded: amount });
    }

    if (decision === 'accept') {
      const result = await acceptAdjustOffer(
        booking,
        { optionIndex, startDate: req.body.startDate, pickupHour: req.body.pickupHour },
        {
          confirmPrice: req.body.confirmPrice === true,
          payAtPickup: req.body.payAtPickup === true,
        }
      );

      // Not an error — the dates are fine, they just cost more than the
      // trip this client agreed to, and nobody is moved onto a bigger bill
      // without being shown the figure first. `payUpfront` on the reply
      // says whether that difference joins their pickup balance or has to
      // be paid now, through the top-up route below.
      if (result.needsPriceConfirmation) return res.status(409).json(result);
      if (!result.ok) return res.status(400).json({ message: result.message });
      return res.json(result.booking);
    }

    return res.status(400).json({ message: 'Choose either new dates or a refund.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// A client who has already settled this booking in full, moving to dates
// that cost more. The difference is collected before anything changes —
// returns a PayMongo checkout URL, and the dates stay put until the money
// lands, so abandoning the payment costs them nothing.
router.post('/:id/adjust/top-up', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const live = booking.status === 'pending' || booking.status === 'confirmed';
    if (!live || booking.adjustOffer?.status !== 'open') {
      return res.status(400).json({ message: 'There is nothing to decide on this booking.' });
    }
    if (new Date(booking.adjustOffer.deadline) <= new Date()) {
      await expireAdjustOffers();
      return res.status(400).json({ message: 'The deadline for this booking has passed, so it has been refunded in full.' });
    }

    const result = await startTopUp(booking, {
      optionIndex: req.body.optionIndex,
      startDate: req.body.startDate,
      pickupHour: req.body.pickupHour,
    });
    if (!result.ok) return res.status(400).json({ message: result.message });
    return res.json({ checkoutUrl: result.checkoutUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Back from that payment. PayMongo is asked what really happened rather
// than the redirect being trusted, the same as the booking payment itself.
router.put('/:id/adjust/top-up/confirm', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const result = await confirmTopUp(booking);
    if (!result.ok) return res.status(400).json({ message: result.message });
    return res.json(result.booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---- making a booking longer ----
//
// A client who wants two more days used to have one option: cancel and book
// again, which costs them their deposit and risks losing the vehicle in the
// gap — for a customer asking to pay more. See utils/extendBooking.js for
// how the price is worked out, which differs before and after pickup.

// Nothing can extend while something else is already deciding this
// booking's dates. Two changes racing each other over the same days is how
// a client ends up somewhere neither of them meant.
const extendBlocker = (booking) => {
  if (!['pending', 'confirmed'].includes(booking.status)) return 'This booking cannot be extended.';
  if (booking.payment !== 'paid') return 'This booking has not been paid for yet.';
  if (booking.refundStatus === 'requested') return 'Resolve your refund request before extending this booking.';
  if (booking.rescheduleRequest?.status === 'pending') return 'Resolve your reschedule request before extending this booking.';
  if (booking.adjustOffer?.status === 'open') return 'Choose new dates or a refund on this booking first.';
  if (bookingSpan(booking).end <= new Date()) return 'This booking has already ended. Please make a new one.';
  return null;
};

// What the client's screen needs: how far they can go, and what a given
// date would cost. Read-only — nothing is held or changed by asking.
router.get('/:id/extension', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const blocked = extendBlocker(booking);
    if (blocked) return res.status(400).json({ message: blocked });

    const latest = await latestPossibleEnd(booking);
    const quote = req.query.endDate ? await quoteExtension(booking, req.query.endDate) : null;

    res.json({
      latestEndDate: latest.end,
      // False means nothing is booked ahead at all. Saying "someone else
      // has it after that" in that case would simply be untrue.
      latestIsAConflict: latest.constrained,
      collected: hasCollectedVehicle(booking),
      currentEndDate: booking.endDate,
      quote,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start paying for one. The days are parked on the booking and only move
// once the money lands.
router.post('/:id/extension', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const blocked = extendBlocker(booking);
    if (blocked) return res.status(400).json({ message: blocked });

    const result = await startExtension(booking, req.body.endDate, req.body.mode);
    if (!result.ok) return res.status(400).json({ message: result.message });
    res.json({ checkoutUrl: result.checkoutUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Back from that payment. PayMongo is asked what really happened rather
// than the redirect being trusted.
router.put('/:id/extension/confirm', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const result = await confirmExtension(booking);
    if (!result.ok) return res.status(400).json({ message: result.message });
    res.json(result.booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
