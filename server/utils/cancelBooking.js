import Car from '../models/Car.js';
import { refundBookingPayment } from './paymongo.js';
import { notifyUser, notifyAdmins } from './notify.js';
import { vehicleUnavailableMessage, formatTripDates } from './blockReasons.js';
import { bookingSpan } from './availability.js';

// Tiered on how long ago the booking was MADE, not on the pickup date.
// Lives here rather than in routes/bookings.js so the admin cancel path and
// the client's own refund request can't drift into different policies.
export function getRefundPercentage(createdAt, now = new Date()) {
  const hoursSinceBooking = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceBooking <= 12) return 100;
  if (hoursSinceBooking <= 24) return 50;
  return 0;
}

export const CANCEL_REASONS = ['vehicle_unavailable', 'client_requested', 'other'];

// What admin cancelling this booking should refund.
//
// vehicle_unavailable is always the full amount: the business pulled the
// car, so the tiered policy — which exists to price a CLIENT changing their
// mind — has nothing to say about it.
//
// client_requested deliberately runs the same tiers the in-app refund button
// applies. Without that, any client past the refund window could get a full
// refund just by messaging admin instead of using the app.
// `now` is injectable so the tiers can actually be checked — a rule about
// money that reads the clock itself can only ever be tested by waiting.
export function refundAmountFor(booking, reason, customAmount, now = new Date()) {
  if (booking.payment !== 'paid' || booking.amountPaid <= 0) return 0;
  if (reason === 'vehicle_unavailable') return booking.amountPaid;
  if (reason === 'client_requested') {
    return Math.round(booking.amountPaid * (getRefundPercentage(booking.createdAt, now) / 100));
  }
  const amount = Number(customAmount);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(Math.round(amount), booking.amountPaid);
}

// A booking whose rental has already started. Deliberately left alone by the
// blocked-dates sweep: the client physically has the car, so cancelling and
// refunding behind their back would be wrong. Surfaced to admin instead.
export const isUnderway = (booking, now = new Date()) => {
  // Through bookingSpan so a booking made before pickup times existed is
  // judged on the calendar days it meant, not on the UTC midnights it was
  // stored at — which are eight hours adrift of them.
  const span = bookingSpan(booking);
  return span.start <= now && span.end >= now;
};

// The full message the client receives, and the short line shown beside
// the refund on their bookings page. Kept apart because a full apology
// reads oddly after "Refund Confirmed: ₱2,000 — Reason:".
function clientWording(booking, reason, amount, carName, cause, clientNote) {
  const trip = `${carName ? `the ${carName}` : 'your vehicle'} (${formatTripDates(booking.startDate, booking.endDate)})`;
  const peso = `₱${amount.toLocaleString()}`;

  if (reason === 'vehicle_unavailable') {
    return {
      message: vehicleUnavailableMessage({
        carName, startDate: booking.startDate, endDate: booking.endDate, cause, amount,
      }),
      short: `Vehicle unavailable due to ${cause}.`,
    };
  }

  if (reason === 'client_requested') {
    return {
      message: `As you requested, your booking for ${trip} has been cancelled.` +
        (amount > 0
          ? ` A refund of ${peso} will be processed in line with our refund policy.`
          : ' Under our refund policy, this booking is no longer eligible for a refund.') +
        ' Thank you for choosing Rent-A-Ride Albay.',
      short: 'Cancelled at your request.',
    };
  }

  return {
    message: `We regret to inform you that your booking for ${trip} has been cancelled by our team.` +
      (amount > 0 ? ` A refund of ${peso} will be processed.` : '') +
      (clientNote ? ` ${clientNote.trim().replace(/([^.!?])$/, '$1.')}` : '') +
      ' If you have any questions, please contact us.',
    short: clientNote || 'Cancelled by our team.',
  };
}

// Cancels and settles a booking in one place, so every caller produces the
// same record. Never throws on a refund failure — the cancellation itself
// must stand even when the payment provider doesn't cooperate, or a broken
// vehicle would stay bookable because of a network error. A failure is
// flagged for admin to settle by hand instead.
//
// cause   — what follows "unavailable due to", for vehicle_unavailable.
//           Always the client-safe phrase, never admin's private note.
// clientNote — optional text admin wrote FOR the client, from the cancel
//           dialog. Distinct from any private note.
// extra   — one more sentence appended to the client's message, for callers
//           that need to explain how the cancellation came about (e.g. an
//           unanswered offer of alternative dates).
export async function cancelBookingWithRefund(booking, { reason, customAmount, cause = 'unforeseen circumstances', clientNote = '', extra = '' }) {
  const amount = refundAmountFor(booking, reason, customAmount);

  const carDoc = booking.car?.brand ? booking.car : await Car.findById(booking.car).select('brand model');
  const carName = carDoc ? `${carDoc.brand} ${carDoc.model}` : '';
  const { message, short } = clientWording(booking, reason, amount, carName, cause, clientNote);

  booking.status = 'cancelled';
  // This cancellation settles any open "new dates or a refund" offer, so it
  // can't be left open for the expiry sweep to act on a second time. Already
  // marked declined/expired when the offer itself is what led here.
  if (booking.adjustOffer?.status === 'open') {
    booking.adjustOffer.status = 'declined';
    booking.adjustOffer.resolvedAt = new Date();
  }
  booking.cancelReason = reason;
  booking.cancelNote = clientNote;
  // Never actually paid — nothing to refund, and it shouldn't keep showing
  // as "GCash Pending" once the booking is dead.
  if (booking.payment === 'gcash_pending') booking.payment = 'offline';

  if (amount > 0) {
    booking.refundStatus = 'approved';
    booking.refundAmount = amount;
    booking.refundReason = short;
    try {
      await refundBookingPayment(booking);
    } catch (err) {
      console.error('Refund failed for booking', booking._id.toString(), err.message);
      await notifyAdmins(
        'Manual Refund Needed',
        `Automatic refund of ₱${amount.toLocaleString()} failed for a booking cancelled by our team — please refund it manually.`,
        '/admin/manage-bookings'
      );
    }
  }

  await booking.save();

  await notifyUser(
    booking.user,
    reason === 'vehicle_unavailable' ? 'Booking Cancelled: Vehicle Unavailable' : 'Booking Cancelled',
    extra ? `${message} ${extra}` : message,
    '/my-bookings'
  );

  return amount;
}
