import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import User from '../models/User.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';
import { refundBookingPayment } from '../utils/paymongo.js';

const router = express.Router();

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
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

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
// `statuses` whose dates overlap [start, end)? Only CONFIRMED bookings are
// treated as a hard block for other clients — a pending request never blocks
// anyone else's request for the same dates, it just risks losing the race
// when one of the pending requests gets confirmed (see the auto-refund
// logic below, which is the actual arbiter).
async function findOverlappingBooking(carId, start, end, statuses, excludeId) {
  const query = {
    car: carId,
    status: { $in: statuses },
    startDate: { $lt: end },
    endDate: { $gt: start },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Booking.findOne(query);
}

// Admin-set blocked ranges (maintenance, owner keeping the car for personal
// use, etc.) are a hard block same as a confirmed booking's dates — just not
// derived from an actual reservation. Not exposed to consignors for now.
async function findBlockedRange(carId, start, end) {
  const car = await Car.findById(carId).select('blockedDates');
  return (car?.blockedDates || []).find((b) => new Date(b.startDate) < end && new Date(b.endDate) > start);
}

// Create booking
router.post('/', protect, async (req, res) => {
    try {
    const { carId, startDate, endDate, paymentType, amountPaid, totalPrice, bookingType, licenseNumber, licenseExpiry, paymentMethod } = req.body;

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

    const requestedStart = new Date(startDate);
    const requestedEnd = new Date(endDate);

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
    const confirmedOverlap = await findOverlappingBooking(carId, requestedStart, requestedEnd, ['confirmed']);
    if (confirmedOverlap) {
      return res.status(400).json({ message: 'This vehicle is already booked for some of the selected dates. Please choose different dates.' });
    }

    const blockedRange = await findBlockedRange(carId, requestedStart, requestedEnd);
    if (blockedRange) {
      return res.status(400).json({ message: 'This vehicle is not available during the selected dates. Please choose different dates.' });
    }

    // Self-drive bookings require a valid, unexpired driver's license on file.
    // If the client just entered one on the booking form, save it to their profile first.
    if (bookingType === 'self-drive') {
      if (licenseNumber && licenseExpiry) {
        currentUser.licenseNumber = licenseNumber;
        currentUser.licenseExpiry = licenseExpiry;
        await currentUser.save();
      }

      if (!currentUser.licenseNumber || !currentUser.licenseExpiry) {
        return res.status(400).json({ message: "A driver's license is required to book self-drive." });
      }
      if (new Date(currentUser.licenseExpiry) < new Date()) {
        return res.status(400).json({ message: 'Your driver\'s license has expired. Please update it to book self-drive.' });
      }
    }

    const start = requestedStart;
    const end = requestedEnd;
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const booking = await Booking.create({
      user: req.user.id,
      car: carId,
      startDate: start,
      endDate: end,
      totalDays,
      totalPrice,
      amountPaid,
      paymentType,
      bookingType: bookingType || 'with-driver',
      payment: paymentMethod === 'gcash' ? 'gcash_pending' : (paymentType === 'full' ? 'paid' : 'offline')
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

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      if (booking.payment !== 'paid') {
        return res.status(400).json({ message: 'This booking cannot be confirmed until the GCash payment is completed.' });
      }

      const car = await Car.findById(booking.car);
      if (!car) return res.status(404).json({ message: 'Car not found' });

      // Re-check for a conflicting CONFIRMED booking right before committing —
      // this is the actual guard against double-booking now that availability
      // is per-date-range instead of one blanket flag on the car.
      const conflict = await findOverlappingBooking(booking.car, booking.startDate, booking.endDate, ['confirmed'], booking._id);
      // Also re-check admin-blocked dates — the admin may have blocked this
      // range after the client's request came in.
      const blockedRange = !conflict ? await findBlockedRange(booking.car, booking.startDate, booking.endDate) : null;

      if (conflict || blockedRange) {
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
        await notifyUser(booking.user, 'Booking Cancelled & Refunded', clientMessage, '/my-bookings');

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

      await notifyUser(booking.user, 'Booking Confirmed', 'Your booking has been confirmed. Check My Bookings for details.', '/my-bookings');
      if (car.owner) {
        await notifyUser(car.owner, 'Vehicle Booked', `Your vehicle ${car.brand} ${car.model} has a new confirmed booking.`, '/consignor');
      }

      return res.json(booking);
    }

    booking.status = status;
    if (status === 'cancelled' && booking.payment === 'gcash_pending') {
      // Never actually paid — nothing to refund, and it shouldn't keep
      // showing as "GCash Pending" once the booking is dead.
      booking.payment = 'offline';
    }
    await booking.save();

    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      await notifyUser(booking.user, 'Booking Cancelled', 'Your booking has been cancelled by our team.', '/my-bookings');
    }
    if (status === 'completed' && previousStatus !== 'completed') {
      await notifyUser(booking.user, 'Vehicle Returned', 'Your vehicle return has been recorded. You can now rate your experience.', '/my-bookings/rate');
    }

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
function getRefundPercentage(createdAt, now = new Date()) {
  const hoursSinceBooking = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceBooking <= 12) return 100;
  if (hoursSinceBooking <= 24) return 50;
  return 0;
}

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
      await notifyUser(booking.user, 'Refund Approved', `Your refund of ₱${booking.refundAmount.toLocaleString()} has been approved.`, '/my-bookings');
    } else if (decision === 'declined') {
      await notifyUser(booking.user, 'Refund Declined', 'Your refund request has been declined.', '/my-bookings');
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
    if (booking.refundStatus !== 'none') {
      return res.status(400).json({ message: 'This booking already has a refund request in progress.' });
    }
    if (booking.rescheduleRequest?.status === 'pending') {
      return res.status(400).json({ message: 'You already have a pending reschedule request for this booking.' });
    }

    const start = new Date(newStartDate);
    const end = new Date(newEndDate);
    if (!newStartDate || !newEndDate || isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ message: 'Please provide a valid date range.' });
    }
    if (start < new Date()) {
      return res.status(400).json({ message: 'The new pickup date must be in the future.' });
    }
    const newDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (newDays !== booking.totalDays) {
      return res.status(400).json({ message: `Reschedule must keep the same trip length (${booking.totalDays} day${booking.totalDays === 1 ? '' : 's'}). Cancel and rebook instead if you need a different duration.` });
    }
    if (start.getTime() === new Date(booking.startDate).getTime() && end.getTime() === new Date(booking.endDate).getTime()) {
      return res.status(400).json({ message: 'Those are already this booking\'s current dates.' });
    }

    const conflict = await findOverlappingBooking(booking.car, start, end, ['confirmed'], booking._id);
    if (conflict) {
      return res.status(400).json({ message: 'This vehicle is already booked for some of those dates. Please choose a different range.' });
    }

    const blockedRange = await findBlockedRange(booking.car, start, end);
    if (blockedRange) {
      return res.status(400).json({ message: 'This vehicle is not available during those dates. Please choose a different range.' });
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

    if (decision === 'approved') {
      // Re-check right before committing — dates could have been claimed by
      // another confirmed booking (or blocked by admin) since the client's
      // original request.
      const conflict = await findOverlappingBooking(booking.car, booking.rescheduleRequest.newStartDate, booking.rescheduleRequest.newEndDate, ['confirmed'], booking._id);
      const blockedRange = !conflict ? await findBlockedRange(booking.car, booking.rescheduleRequest.newStartDate, booking.rescheduleRequest.newEndDate) : null;
      if (conflict || blockedRange) {
        booking.rescheduleRequest.status = 'declined';
        booking.rescheduleRequest.adminNotes = blockedRange
          ? 'Automatically declined: those dates are blocked.'
          : 'Automatically declined: those dates were booked by someone else in the meantime.';
        await booking.save();
        await notifyUser(booking.user, 'Reschedule Declined', 'Your reschedule request could not be approved because those dates are no longer available. Your original dates are unchanged.', '/my-bookings');
        return res.json(booking);
      }

      booking.startDate = booking.rescheduleRequest.newStartDate;
      booking.endDate = booking.rescheduleRequest.newEndDate;
      booking.rescheduleRequest.status = 'approved';
      await booking.save();
      await notifyUser(booking.user, 'Reschedule Approved', 'Your booking has been moved to the new dates you requested.', '/my-bookings');

      const car = await Car.findById(booking.car).select('brand model owner');
      if (car?.owner) {
        await notifyUser(car.owner, 'Booking Rescheduled', `A booking for your vehicle ${car.brand} ${car.model} was moved to new dates.`, '/consignor');
      }
    } else {
      booking.rescheduleRequest.status = 'declined';
      booking.rescheduleRequest.adminNotes = adminNotes || '';
      await booking.save();
      await notifyUser(booking.user, 'Reschedule Declined', `Your reschedule request was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}`, '/my-bookings');
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

export default router;