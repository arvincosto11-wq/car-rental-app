import Car from '../models/Car.js';
import { refundBookingPayment } from './paymongo.js';
import { notifyUser, notifyAdmins } from './notify.js';
import { vehicleUnavailableMessage, formatTripDates } from './blockReasons.js';
import { bookingSpan } from './availability.js';
import { phYmd } from './phTime.js';

// Tiered on how long ago the booking was MADE, not on the pickup date.
// Lives here rather than in routes/bookings.js so the admin cancel path and
// the client's own refund request can't drift into different policies.
export function getRefundPercentage(createdAt, now = new Date()) {
  const hoursSinceBooking = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceBooking <= 12) return 100;
  if (hoursSinceBooking <= 24) return 50;
  return 0;
}

// What a cancellation can be, and nothing else. 'other' used to be here
// with a free-typed amount, which made the dialog's own promise — that the
// reason decides the refund — untrue. It also meant a client could be
// cancelled and handed back ₱1 with no explanation, which is the shape of
// a scam whatever anybody intended. Old records keep it; nothing new can.
export const CANCEL_REASONS = [
  'vehicle_unavailable', 'client_requested', 'terms_not_met',
  // A trip that ended in the middle because the vehicle stopped working.
  // Apart from vehicle_unavailable because that refunds everything, which is
  // right when we pull a car before a trip and wrong once somebody has had
  // three days of it.
  'breakdown', 'breakdown_client',
  // A vehicle that never came back and could not be recovered. Recorded so
  // the business knows what happened to its car — deliberately NOT said to
  // the client, who gets the plain "cancelled by our team" wording. An
  // automated message accusing somebody of keeping a vehicle is a thing to
  // be sure of before sending, and the system cannot be: they might be in
  // hospital. That conversation belongs to a person.
  'not_returned',
];

// Days paid for and not had. The refund is the same for both breakdown
// reasons on purpose: you do not keep money for days nobody had the vehicle,
// whoever broke it. Fault is priced where it actually lands @ in the repair
// bill @ which is both easier to explain to an angry customer and usually
// the larger figure anyway.
//
// The day it broke is the only place fault touches this. A client charged a
// full day for a morning that ended with our engine failing has a fair
// complaint; a client who wrote the car off that morning does not.
export function unusedDayRefund(booking, { chargeBrokenDay }, now = new Date()) {
  const total = booking.totalDays || 1;
  const span = bookingSpan(booking);
  const elapsedDays = (now.getTime() - span.start.getTime()) / (24 * 60 * 60 * 1000);

  // Before it even started, nothing has been used.
  const raw = elapsedDays <= 0 ? 0 : (chargeBrokenDay ? Math.ceil(elapsedDays) : Math.floor(elapsedDays));
  const used = Math.min(total, Math.max(0, raw));

  // What the days they actually had were worth, against what they have
  // handed over. A client on a deposit may have paid less than they have
  // used, and then nothing comes back rather than a negative number.
  const owedForUsed = Math.round((booking.totalPrice || 0) * (used / total));
  return Math.max(0, Math.min(booking.amountPaid, booking.amountPaid - owedForUsed));
}

// Half back if the booking is cancelled before the day it was due to start,
// nothing on the day itself. The deduction exists because the vehicle can no
// longer be let to anybody else, so once it IS that day, the day is gone
// whether this happens at 7:00 AM or at the counter.
//
// Deliberately a date rather than a moment: "on the pickup day" is a line
// anyone can check, where "at pickup" would be a judgement call — and
// judgement calls are what this whole list exists to remove.
const TERMS_NOT_MET_PERCENT = 50;

// Not every reason fits every booking. Returns why a reason can't be used,
// or null when it can — the dialog hides what it gets back here, and the
// route refuses it, so the two can't drift apart.
export function reasonUnavailable(booking, reason) {
  if ((reason === 'breakdown' || reason === 'breakdown_client') && !booking.collectedAt) {
    return 'This vehicle has not been collected, so nothing broke down mid-trip. Use "Vehicle unavailable" instead.';
  }
  if (reason === 'not_returned' && !booking.collectedAt) {
    return 'This vehicle was never collected, so it cannot be unreturned. Use "Vehicle unavailable" instead.';
  }
  if (reason === 'terms_not_met' && booking.collectedAt) {
    return 'This client already picked the vehicle up, so the booking conditions were met. Choose another reason.';
  }
  return null;
}

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
export function refundAmountFor(booking, reason, now = new Date()) {
  if (booking.payment !== 'paid' || booking.amountPaid <= 0) return 0;
  if (reason === 'vehicle_unavailable') return booking.amountPaid;
  if (reason === 'client_requested') {
    return Math.round(booking.amountPaid * (getRefundPercentage(booking.createdAt, now) / 100));
  }
  if (reason === 'terms_not_met') {
    const onTheDay = phYmd(now) >= phYmd(bookingSpan(booking).start);
    return onTheDay ? 0 : Math.round(booking.amountPaid * (TERMS_NOT_MET_PERCENT / 100));
  }
  // They have had the vehicle for the whole trip and beyond, so there are
  // no unused days to give back. Worked out rather than hardcoded to zero,
  // so a booking cancelled this way mid-trip still returns what it should.
  if (reason === 'not_returned') return unusedDayRefund(booking, { chargeBrokenDay: true }, now);
  // Our vehicle failed, so the day it failed on is not a day of service.
  if (reason === 'breakdown') return unusedDayRefund(booking, { chargeBrokenDay: false }, now);
  // They had the use of the day they wrecked it on, whatever else is true.
  if (reason === 'breakdown_client') return unusedDayRefund(booking, { chargeBrokenDay: true }, now);
  // Includes 'other', which no longer exists as a choice. Nothing should
  // reach here, and returning zero silently would be worse than obvious.
  return 0;
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

  if (reason === 'breakdown' || reason === 'breakdown_client') {
    return {
      message: `Your booking for ${trip} has been ended early because the vehicle is no longer roadworthy.`
        + (amount > 0
          ? ` The days you paid for and did not get (${peso}) will be refunded.`
          : ' The days you had account for what you paid, so there is nothing to refund.')
        + (reason === 'breakdown_client'
          ? ' Any repair costs are charged separately, as set out in our Terms and Conditions.'
          : '')
        + (clientNote ? ` ${clientNote.trim().replace(/([^.!?])$/, '$1.')}` : '')
        + ' If you have any questions, please contact us.',
      short: clientNote || 'The vehicle broke down.',
    };
  }

  if (reason === 'terms_not_met') {
    // Firm, and specific about which rule and what it costs. Vague is what
    // makes a deduction feel arbitrary; naming the clause they agreed to is
    // what makes it a policy.
    return {
      message: `Your booking for ${trip} has been cancelled because the booking conditions were not met.` +
        (amount > 0
          ? ` As set out in our Terms and Conditions, half of what you paid (${peso}) will be refunded.`
          : ' As set out in our Terms and Conditions, cancellations on the pickup date are not refunded,'
            + ' because the vehicle can no longer be rented for that day.') +
        (clientNote ? ` ${clientNote.trim().replace(/([^.!?])$/, '$1.')}` : '') +
        ' If you believe this is a mistake, please contact us.',
      short: clientNote || 'Booking conditions were not met.',
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
// The amount is never passed in: the reason decides it, which is the whole
// point of having reasons at all.
// extra   — one more sentence appended to the client's message, for callers
//           that need to explain how the cancellation came about (e.g. an
//           unanswered offer of alternative dates).
export async function cancelBookingWithRefund(booking, { reason, cause = 'unforeseen circumstances', clientNote = '', extra = '' }) {
  const amount = refundAmountFor(booking, reason);

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

  // In writing, because it is money and because the trip they planned is
  // not happening.
  await notifyUser(
    booking.user,
    reason === 'vehicle_unavailable' ? 'Booking Cancelled: Vehicle Unavailable' : 'Booking Cancelled',
    extra ? `${message} ${extra}` : message,
    '/my-bookings',
    { email: true }
  );

  return amount;
}
