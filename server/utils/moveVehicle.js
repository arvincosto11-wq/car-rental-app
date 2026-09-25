import Car from '../models/Car.js';
import { busySpans, bookingSpan, overlaps } from './availability.js';

// Changing the vehicle on a booking that is already running.
//
// A breakdown gets settled on the phone: the client is at the roadside and
// somebody has to work out whether a replacement can reach them or whether
// they would rather go home and take the money. So this is a tool for the
// person having that conversation, not an offer sent to a client — the same
// information as the bumped-booking offer, put where the decision is made.
//
// Useful beyond breakdowns: a client who wants a bigger car on day two, or
// any swap agreed by phone, is the same operation.

// The part of the trip that has not happened yet. A vehicle only has to be
// free from now on — the days already spent were spent in the old one.
export const remainingSpan = (booking, now = new Date()) => {
  const span = bookingSpan(booking);
  return { start: span.start > now ? span.start : now, end: span.end };
};

// Days had, and days still to come. Whole days, and never more than the trip
// holds, so a booking read after its return date does not go negative.
export const splitDays = (booking, now = new Date()) => {
  const total = booking.totalDays || 1;
  const span = bookingSpan(booking);
  const elapsed = (now.getTime() - span.start.getTime()) / (24 * 60 * 60 * 1000);
  const used = Math.min(total, Math.max(0, elapsed <= 0 ? 0 : Math.floor(elapsed)));
  return { total, used, left: total - used };
};

// What the booking comes to if it changes hands today: the days already had
// at the rate they were sold at, and the rest at the new vehicle's.
//
// The old rate is taken from the booking rather than the car's list price,
// so a discount or promo the client actually received is what they keep
// being charged for the days they used.
export const repriceForSwap = (booking, newPricePerDay, now = new Date()) => {
  const { total, used, left } = splitDays(booking, now);
  const soldRate = (booking.totalPrice || 0) / total;
  const newTotal = Math.round(soldRate * used) + Math.round((Number(newPricePerDay) || 0) * left);
  return {
    used,
    left,
    newTotal,
    // Positive: the client owes more. Negative: money goes back to them.
    difference: newTotal - (booking.totalPrice || 0),
  };
};

// Vehicles that could take over this booking from today.
//
// Every price is offered, unlike the client-facing offer, because this is a
// conversation: admin can see a dearer car and agree a top-up on the phone,
// which is not something to negotiate through a notification.
export async function vehiclesForSwap(booking, { now = new Date() } = {}) {
  const wanted = remainingSpan(booking, now);
  if (wanted.end <= wanted.start) return [];

  const candidates = await Car.find({
    _id: { $ne: booking.car },
    status: { $ne: 'draft' },
    isAvailable: true,
    archived: { $ne: true },
    'offRoad.since': null,
    availableBookingTypes: booking.bookingType,
  }).lean();

  const free = [];
  for (const car of candidates) {
    const { spans } = await busySpans(car._id, { car });
    if (spans.some((b) => overlaps(wanted, b))) continue;
    free.push({
      id: String(car._id),
      brand: car.brand,
      model: car.model,
      image: car.image || '',
      plateNumber: car.plateNumber || '',
      pricePerDay: car.pricePerDay,
      ...repriceForSwap(booking, car.pricePerDay, now),
    });
  }

  // Cheapest difference first: the swap that costs the client least is the
  // easiest one to agree to over the phone.
  free.sort((a, b) => a.difference - b.difference);
  return free;
}
