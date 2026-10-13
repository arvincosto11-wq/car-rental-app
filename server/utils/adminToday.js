import { daysOverdue, isOverdue } from './overdue.js';
import { registrationLapsed } from './registration.js';

// What the admin dashboard needs to answer "what does today need?", worked
// out in one place so the page can stay a page.
//
// Every figure here is read from a booking or a vehicle as it already
// stands. Nothing is estimated, and anything the data cannot answer is
// left out rather than guessed at — a dashboard that invents a number is
// worse than one that stays quiet.

// What is still owed on a booking whose client paid a deposit. Paid in
// full means nothing is due, which is not the same as a zero balance
// nobody has collected yet.
export const balanceDue = (booking) => Math.max(0, (booking.totalPrice || 0) - (booking.amountPaid || 0));

// The fine as it stands right now on a vehicle still out, rather than the
// one written when it came back. One day's rental per day of delay — the
// terms' own unit, and the same rule the counter charges on return (see
// lateFeeFor in overdueReturns.js). Lateness already settled by extending
// is carried, exactly as it is there.
export const lateFeeSoFar = (booking, pricePerDay, now = new Date()) => {
  if (!isOverdue(booking, now)) return 0;
  const days = daysOverdue(booking, now);
  const carried = booking?.lateFee?.carriedAmount || 0;
  return days * (Number(pricePerDay) || 0) + carried;
};

// Money recorded against a booking that nobody has taken in yet. Each kind
// carries its own collectedAt, so a settled late fee does not hide an
// unsettled damage charge on the same booking.
export const unsettledCharges = (booking) => {
  const out = [];
  if ((booking.lateFee?.amount || 0) > 0 && !booking.lateFee?.collectedAt) {
    out.push({ kind: 'Late fee', amount: booking.lateFee.amount, days: booking.lateFee.days || 0 });
  }
  if ((booking.fuel?.charge || 0) > 0 && !booking.fuel?.collectedAt) {
    out.push({ kind: 'Refuelling', amount: booking.fuel.charge });
  }
  if ((booking.condition?.damageCharge || 0) > 0 && !booking.condition?.damageCollectedAt) {
    out.push({ kind: 'Damage', amount: booking.condition.damageCharge });
  }
  return out;
};

// One status per vehicle, in the order that decides what somebody does
// about it. A car with expired papers sitting in the workshop is reported
// as expired, because that is the thing that has to be fixed first and the
// thing that keeps it off the site even once it is repaired.
export const vehicleState = (car, outIds, now = new Date()) => {
  if (registrationLapsed(car, now)) return 'expired';
  if (car.offRoad?.since) return 'offRoad';
  if (car.isAvailable === false) return 'hidden';
  if (outIds.has(String(car._id))) return 'out';
  return 'free';
};

// Revenue against the same stretch of the period before, never against the
// whole of it: on the 14th, comparing this month's takings with all of last
// month says business has collapsed every month until the 28th.
export const comparePeriods = (current, previous) => {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
};
