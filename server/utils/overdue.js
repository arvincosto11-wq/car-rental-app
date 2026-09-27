// A vehicle that went out and has not come back.
//
// Before this, a booking simply completed itself the day after its return
// date — the calendar said the trip was over, so the trip was over. The
// client was asked to rate a journey they were still on, the consignor was
// credited for a rental that hadn't ended, and the dates went back on sale
// while the car sat in somebody's garage.
//
// Only a recorded handover counts as "went out". A booking nobody marked as
// picked up still completes on the old rule, because there is nothing to
// say the vehicle ever left.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/overdue.js). The admin panel, the daily chase, the
// refusal to book again and the notice on a vehicle page all have to agree
// on who is overdue, and two descriptions of one rule have drifted here
// before.
export const isOverdue = (booking, now = new Date()) =>
  booking.status === 'confirmed'
  && !!booking.collectedAt
  && !booking.returnedAt
  && new Date(booking.endDate) < now;

// Whole days past the return time, rounded up, and zero when it was on
// time. An hour late and a day late are the same thing to whoever needed
// the car this morning — and it is the terms' own unit: "one day's rental
// rate per day of delay".
export const daysLate = (booking, at) => {
  if (!at || !booking?.endDate) return 0;
  const ms = new Date(at).getTime() - new Date(booking.endDate).getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
};

// How late it is right now, for chasing somebody who still has the vehicle.
// Never zero: this is only ever asked about a booking already past its time.
export const daysOverdue = (booking, now = new Date()) => Math.max(1, daysLate(booking, now));
