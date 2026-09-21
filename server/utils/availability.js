import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import { dayAlignedSpan, addHours, addDays, turnaroundHoursFor } from './phTime.js';

// One answer to "is this vehicle free then?", used by every route that has
// to decide it — creating a booking, confirming one, approving a reschedule,
// blocking dates, and finding alternatives to offer a bumped client.
//
// It exists because the answer stopped being a plain date-range comparison
// once bookings carried real pickup times. Two things have to happen that a
// Mongo range query can't do on its own:
//
//   * a booking owns the TURNAROUND either side of it as well as its own
//     dates, so the vehicle can be checked and cleaned and a late return
//     doesn't eat into the next client's trip; and
//   * anything saved before pickup times existed sits at UTC midnight,
//     eight hours adrift from the Legazpi day it was meant to mean, so it
//     has to be snapped before it can be compared with anything new.

// What a booking really occupies. Bookings made before times existed are
// snapped to the calendar days they meant.
export const bookingSpan = (booking) => (booking.hasPickupTime
  ? { start: new Date(booking.startDate), end: new Date(booking.endDate) }
  : dayAlignedSpan(booking.startDate, booking.endDate));

// Same for a blocked range. A whole-day block runs midnight to midnight in
// Legazpi; the end is the day the vehicle is back, not the last day it's off
// the road, which is how blocked ranges have always worked here.
export const blockedSpan = (block) => (block.hasTime
  ? { start: new Date(block.startDate), end: new Date(block.endDate) }
  : dayAlignedSpan(block.startDate, block.endDate));

// The turnaround is added to BOTH ends of a booking, because either booking
// in a pair can be the one made second — padding only the earlier one would
// let a client return at 9:00 AM exactly as the next client collects.
export const padded = (span, hours) => ({
  start: addHours(span.start, -hours),
  end: addHours(span.end, hours),
});

export const overlaps = (a, b) => a.start < b.end && a.end > b.start;

// Blocked ranges deliberately get no turnaround: a vehicle coming out of the
// workshop needs no cleaning window, and admin can block an extra hour if it
// does. The buffer is between customers only.
const blockRanges = (car, extraBlocks) => [
  ...(car?.blockedDates || []).filter((b) => b.status === 'approved'),
  ...extraBlocks,
].map((b) => ({ ...blockedSpan(b), kind: 'block' }));

// Every span that stands in the way of booking this vehicle.
//
// `extraBlocks` covers a range that is about to be saved but hasn't been
// written yet — the block being created in this very request — so we never
// hand out dates that the thing causing the question has already claimed.
export async function busySpans(carId, {
  statuses = ['confirmed'],
  excludeBookingId = null,
  extraBlocks = [],
  car: preloaded = null,
} = {}) {
  const car = preloaded || await Car.findById(carId).select('blockedDates turnaroundHours').lean();
  const turnaroundHours = turnaroundHoursFor(car);

  const query = { car: carId, status: { $in: statuses } };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const bookings = await Booking.find(query).select('startDate endDate hasPickupTime').lean();

  return {
    turnaroundHours,
    spans: [
      ...bookings.map((b) => ({ ...padded(bookingSpan(b), turnaroundHours), kind: 'booking' })),
      ...blockRanges(car, extraBlocks),
    ],
  };
}

// The first thing in the way, or null. Carries `kind` so a caller can say
// whether the vehicle is booked or off the road — the two mean different
// things to a client.
export const firstConflict = (span, spans) => spans.find((s) => overlaps(span, s)) || null;

// Bookings that a range would disturb. Queried a day wide on either side and
// then compared precisely, because the stored dates of anything predating
// pickup times are eight hours out and a tight query would miss them.
export async function bookingsOverlapping(carId, span, statuses = ['confirmed', 'pending']) {
  const candidates = await Booking.find({
    car: carId,
    status: { $in: statuses },
    startDate: { $lt: addDays(span.end, 1) },
    endDate: { $gt: addDays(span.start, -1) },
  }).populate('user', 'name');
  return candidates.filter((b) => overlaps(bookingSpan(b), span));
}
