import Booking from '../models/Booking.js';
import { notifyUser, notifyAdmins } from './notify.js';
import { phYmd, formatMoment } from './phTime.js';

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
export const isOverdue = (booking, now = new Date()) =>
  booking.status === 'confirmed'
  && !!booking.collectedAt
  && !booking.returnedAt
  && new Date(booking.endDate) < now;

// Whole days past the return time, rounded up, and zero when it was on
// time. An hour late and a day late are the same thing to whoever needed
// the car this morning @ and it is the terms' own unit: "one day's rental
// rate per day of delay".
export const daysLate = (booking, at) => {
  if (!at || !booking?.endDate) return 0;
  const ms = new Date(at).getTime() - new Date(booking.endDate).getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
};

// How late it is right now, for chasing somebody who still has the vehicle.
// Never zero: this is only ever asked about a booking already past its time.
export const daysOverdue = (booking, now = new Date()) => Math.max(1, daysLate(booking, now));

// Terms and Conditions, section 8: "Late returns will be charged an
// additional fee equivalent to one day's rental rate per day of delay."
// Worked out from the clause rather than typed, for the same reason the
// cancellation reasons decide their own refunds @ a figure somebody enters
// by hand is a figure nobody can check.
export function lateFeeFor(booking, pricePerDay) {
  const days = daysLate(booking, booking.returnedAt);
  return { days, amount: days * (Number(pricePerDay) || 0) };
}

// How far ahead of the return a client is warned. A day is enough to change
// somebody's plans and not so far that they forget again before it matters.
export const DUE_SOON_HOURS = 24;

// Out, and due back within the day. Nothing has gone wrong yet — the whole
// point is to reach them while it still hasn't.
export const isDueSoon = (booking, now = new Date()) =>
  booking.status === 'confirmed'
  && !!booking.collectedAt
  && !booking.returnedAt
  && new Date(booking.endDate) >= now
  && new Date(booking.endDate) <= new Date(now.getTime() + DUE_SOON_HOURS * 60 * 60 * 1000);

// A word before the deadline rather than a bill after it. Told once per
// Philippine calendar day, like the chase that follows it.
export async function notifyUpcomingReturns({ userId = null } = {}) {
  const now = new Date();
  const today = phYmd(now);

  const query = {
    status: 'confirmed',
    collectedAt: { $ne: null },
    returnedAt: null,
    endDate: { $gte: now, $lte: new Date(now.getTime() + DUE_SOON_HOURS * 60 * 60 * 1000) },
    dueSoonNotifiedOn: { $ne: today },
  };
  if (userId) query.user = userId;

  const due = await Booking.find(query).populate('car', 'brand model');

  for (const booking of due) {
    const car = booking.car ? `${booking.car.brand} ${booking.car.model}` : 'Your vehicle';
    booking.dueSoonNotifiedOn = today;
    await booking.save();

    await notifyUser(
      booking.user,
      'Your return is due soon',
      `${car} is due back on ${formatMoment(booking.endDate, booking.hasPickupTime)}. `
        + "Please return it on time — our terms charge a late fee of one day's rental for every day a "
        + 'vehicle comes back late. If you need it longer, you can extend the booking from My Bookings.',
      '/my-bookings',
      { email: true }
    );
  }

  return due.length;
}

// Chases anything still out. Told once per Philippine calendar day, not once
// per page load — this runs on every admin fetch, and an inbox filling up
// with the same message is how people learn to ignore it.
export async function notifyOverdueReturns({ userId = null } = {}) {
  const now = new Date();
  const today = phYmd(now);

  const query = {
    status: 'confirmed',
    collectedAt: { $ne: null },
    returnedAt: null,
    endDate: { $lt: now },
    overdueNotifiedOn: { $ne: today },
  };
  if (userId) query.user = userId;

  const late = await Booking.find(query).populate('car', 'brand model owner');

  for (const booking of late) {
    const days = daysOverdue(booking, now);
    const car = booking.car ? `${booking.car.brand} ${booking.car.model}` : 'the vehicle';
    booking.overdueNotifiedOn = today;
    await booking.save();

    await notifyUser(
      booking.user,
      days === 1 ? 'Your return is overdue' : `Your return is ${days} days overdue`,
      `${car} was due back on ${formatMoment(booking.endDate, booking.hasPickupTime)}. `
        + 'Please return it as soon as you can, or contact us if something has gone wrong. '
        + 'Our terms charge a late fee for every day a vehicle comes back late, and somebody else may be waiting for it.',
      '/my-bookings',
      // Somebody has a car they were due to give back. A line in a bell
      // they may never open is not enough.
      { email: true }
    );

    // The person who owns the car. It is their asset sitting in a stranger's
    // garage past its return date, and until now they were the only party
    // nobody told.
    if (booking.car?.owner) {
      await notifyUser(
        booking.car.owner,
        'Your vehicle is overdue',
        `${car} has not been returned. It was due back on ${formatMoment(booking.endDate, booking.hasPickupTime)}, `
          + `${days} day${days === 1 ? '' : 's'} ago. We are chasing the client and the dates stay blocked until it is back.`,
        '/consignor'
      );
    }

    await notifyAdmins(
      'Vehicle not returned',
      `${car} is ${days} day${days === 1 ? '' : 's'} overdue. It stays blocked on the calendar until it is marked returned.`,
      '/admin/manage-bookings'
    );
  }

  return late.length;
}
