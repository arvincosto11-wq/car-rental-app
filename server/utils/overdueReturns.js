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

// Whole days past the return time, counted from one. An hour late and a
// day late are the same thing to a client who needs the car tomorrow.
export const daysOverdue = (booking, now = new Date()) =>
  Math.max(1, Math.ceil((now.getTime() - new Date(booking.endDate).getTime()) / (24 * 60 * 60 * 1000)));

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

  const late = await Booking.find(query).populate('car', 'brand model');

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

    await notifyAdmins(
      'Vehicle not returned',
      `${car} is ${days} day${days === 1 ? '' : 's'} overdue. It stays blocked on the calendar until it is marked returned.`,
      '/admin/manage-bookings'
    );
  }

  return late.length;
}
