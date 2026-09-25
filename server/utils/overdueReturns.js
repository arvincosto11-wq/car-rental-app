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
// What a client who extends pays for the days they were already late.
//
// Half, and half is not arbitrary. The fine is one day's rental per day, so
// a client two days late who extends by one pays half the fine plus a day's
// rent @ exactly what returning on the spot would have cost @ and gets a
// day's use for it. The business takes the same money and the vehicle stops
// being unaccounted for, which is the whole point.
export const EXTENSION_LATE_DISCOUNT = 0.5;

export const carriedLateFee = (days, pricePerDay) =>
  Math.round(days * (Number(pricePerDay) || 0) * EXTENSION_LATE_DISCOUNT);

export function lateFeeFor(booking, pricePerDay) {
  // Days late against the return date as it stands now, plus any lateness
  // already settled through an extension. The second half would otherwise
  // disappear the moment the end date moved.
  const fresh = daysLate(booking, booking.returnedAt);
  const carriedDays = booking?.lateFee?.carriedDays || 0;
  const carriedAmount = booking?.lateFee?.carriedAmount || 0;
  return {
    days: fresh + carriedDays,
    amount: fresh * (Number(pricePerDay) || 0) + carriedAmount,
  };
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

// How close the next booking has to be before an overdue vehicle stops being
// a paperwork problem and becomes somebody's ruined afternoon. Half a day:
// far enough ahead to ring people while it can still be sorted, near enough
// that we are not frightening a client over a car two hours late for a trip
// that starts on Thursday.
export const COLLISION_HOURS = 12;

// An overdue vehicle with somebody waiting for it.
//
// The blocking we do stops NEW bookings being made on a car that is out. It
// does nothing about the ones already there, so the next client's booking
// sits quietly in the calendar until they turn up to a vehicle that isn't
// back. Nobody found out until the counter.
//
// Deliberately only a warning to both sides. Cancelling or moving that
// client automatically would be wrong: the car might be twenty minutes
// away, and only a person ringing another person can find that out.
export async function warnOfCollidingBookings({ now = new Date() } = {}) {
  const today = phYmd(now);
  const late = await Booking.find({
    status: 'confirmed',
    collectedAt: { $ne: null },
    returnedAt: null,
    endDate: { $lt: now },
  }).populate('car', 'brand model');

  let warned = 0;
  for (const booking of late) {
    const next = await Booking.findOne({
      car: booking.car?._id || booking.car,
      _id: { $ne: booking._id },
      status: { $in: ['pending', 'confirmed'] },
      startDate: { $gte: booking.endDate, $lte: new Date(now.getTime() + COLLISION_HOURS * 60 * 60 * 1000) },
      delayWarnedOn: { $ne: today },
    }).sort({ startDate: 1 }).populate('user', 'name');
    if (!next) continue;

    const car = booking.car ? `${booking.car.brand} ${booking.car.model}` : 'A vehicle';
    next.delayWarnedOn = today;
    await next.save();
    warned += 1;

    await notifyAdmins(
      'An overdue vehicle is booked again shortly',
      `${car} is ${daysOverdue(booking, now)} day(s) overdue and ${next.user?.name || 'another client'} is `
        + `booked to collect it at ${formatMoment(next.startDate, next.hasPickupTime)}. `
        + 'Both clients need a call: this cannot be settled from a screen.',
      '/admin/manage-bookings'
    );

    await notifyUser(
      next.user?._id || next.user,
      'Your vehicle may be delayed',
      `The ${car} you have booked for ${formatMoment(next.startDate, next.hasPickupTime)} has not been `
        + 'returned by the previous renter yet. We are chasing it and will contact you shortly. '
        + 'If it cannot be ready in time we will offer you another vehicle or a full refund.',
      '/my-bookings',
      // They may be about to set off for a vehicle that is not there.
      { email: true }
    );
  }

  return warned;
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
