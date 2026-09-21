// The "keep your booking on other dates, or take a refund" offer — the pure
// logic behind its timing and wording.
//
// This file has no imports so the client keeps an identical copy
// (client/src/utils/offerWindow.js): the deadline a client watches count
// down is the very same one the server enforces when it expires the offer.

const HOUR = 1000 * 60 * 60;

// How long a client gets to choose. Their deposit is held the whole time, so
// this can't be open-ended — it either becomes a booking or becomes a refund.
export const OFFER_WINDOW_HOURS = 24;

// A pickup this close leaves no time to arrange anything, so there is no
// point asking: those bookings are refunded outright instead.
export const MIN_NOTICE_HOURS = 2;

// The window never outlives the pickup it's about — nobody should still be
// deciding at the hour they were meant to collect the vehicle. That's what
// makes the deadline "24 hours, or sooner if the trip is sooner".
export const offerDeadline = (startDate, now = new Date()) =>
  new Date(Math.min(now.getTime() + OFFER_WINDOW_HOURS * HOUR, new Date(startDate).getTime()));

export const hasEnoughNotice = (startDate, now = new Date()) =>
  new Date(startDate).getTime() - now.getTime() > MIN_NOTICE_HOURS * HOUR;

export const isOfferOpen = (offer, now = new Date()) =>
  !!offer && offer.status === 'open' && new Date(offer.deadline).getTime() > now.getTime();

// Counts down in whole hours until the last hour, then in minutes — an
// "in 1 hour" that sits there for 59 minutes reads as broken.
export const timeLeftLabel = (deadline, now = new Date()) => {
  const ms = new Date(deadline).getTime() - now.getTime();
  if (ms <= 0) return 'Time is up';
  const hours = Math.floor(ms / HOUR);
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} left to decide`;
  const minutes = Math.max(1, Math.round(ms / (1000 * 60)));
  return `${minutes} minute${minutes === 1 ? '' : 's'} left to decide`;
};

// Why this booking can't go ahead on its original dates, in the client's
// words. Never mentions the other client, and never the admin's private note.
export const offerReasonText = (reason, cause) =>
  reason === 'booking_conflict'
    ? 'Another reservation for this vehicle was confirmed for your dates.'
    : `This vehicle is unavailable on your dates due to ${cause || 'unforeseen circumstances'}.`;

// The exact notification a client receives when they're asked to choose.
// It lives here so the admin's preview of it is written by the very same
// function that sends it, the way the blocked-dates wording already works.
export const offerMessage = ({ reason, cause, carName, totalDays, optionCount, deadlineText }) =>
  `${offerReasonText(reason, cause)} We can still do your ${totalDays}-day trip in the ${carName} on `
  + `${optionCount === 1 ? 'another date' : `${optionCount} other dates`}`
  + ' — open your bookings to choose one, or take a full refund.'
  + ` Please decide by ${deadlineText}; if we don't hear from you, we'll refund you automatically.`;

// An offer only means anything while the booking is still live. Admin can
// cancel a booking through other routes (a no-show, an approved refund
// request) without touching the offer on it, and a settled booking must
// never still be presenting a choice — or, worse, be picked up by the
// expiry sweep and refunded a second time.
export const bookingAwaitingDecision = (booking, now = new Date()) =>
  !!booking
  && (booking.status === 'pending' || booking.status === 'confirmed')
  && isOfferOpen(booking.adjustOffer, now);
