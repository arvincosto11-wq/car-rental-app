import { refundBookingPayment } from './paymongo.js';
import { notifyUser, notifyAdmins } from './notify.js';

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

const REASON_TEXT = {
  vehicle_unavailable: 'the vehicle became unavailable',
  client_requested: 'you asked us to cancel it',
  other: 'it was cancelled by our team',
};

// What admin cancelling this booking should refund.
//
// vehicle_unavailable is always the full amount: the business pulled the
// car, so the tiered policy — which exists to price a CLIENT changing their
// mind — has nothing to say about it.
//
// client_requested deliberately runs the same tiers the in-app refund button
// applies. Without that, any client past the refund window could get a full
// refund just by messaging admin instead of using the app.
export function refundAmountFor(booking, reason, customAmount) {
  if (booking.payment !== 'paid' || booking.amountPaid <= 0) return 0;
  if (reason === 'vehicle_unavailable') return booking.amountPaid;
  if (reason === 'client_requested') {
    return Math.round(booking.amountPaid * (getRefundPercentage(booking.createdAt) / 100));
  }
  const amount = Number(customAmount);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(Math.round(amount), booking.amountPaid);
}

// A booking whose rental has already started. Deliberately left alone by the
// blocked-dates sweep: the client physically has the car, so cancelling and
// refunding behind their back would be wrong. Surfaced to admin instead.
export const isUnderway = (booking, now = new Date()) =>
  new Date(booking.startDate) <= now && new Date(booking.endDate) >= now;

// Cancels and settles a booking in one place, so every caller produces the
// same record. Never throws on a refund failure — the cancellation itself
// must stand even when the payment provider doesn't cooperate, or a broken
// vehicle would stay bookable because of a network error. A failure is
// flagged for admin to settle by hand instead.
export async function cancelBookingWithRefund(booking, { reason, customAmount, note = '' }) {
  const amount = refundAmountFor(booking, reason, customAmount);

  booking.status = 'cancelled';
  booking.cancelReason = reason;
  booking.cancelNote = note;
  // Never actually paid — nothing to refund, and it shouldn't keep showing
  // as "GCash Pending" once the booking is dead.
  if (booking.payment === 'gcash_pending') booking.payment = 'offline';

  if (amount > 0) {
    booking.refundStatus = 'approved';
    booking.refundAmount = amount;
    booking.refundReason = note || `Cancelled by our team: ${REASON_TEXT[reason] || 'cancelled'}.`;
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

  const refundLine = amount > 0
    ? ` A refund of ₱${amount.toLocaleString()} has been approved.`
    : '';
  await notifyUser(
    booking.user,
    'Booking Cancelled',
    `Your booking was cancelled because ${REASON_TEXT[reason] || 'it was cancelled by our team'}.${refundLine}`,
    '/my-bookings'
  );

  return amount;
}
