import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import LongRentalDiscount from '../models/LongRentalDiscount.js';
import { computeBookingPrice } from './promo.js';
import { cancelBookingWithRefund } from './cancelBooking.js';
import { notifyUser } from './notify.js';
import { formatTripDates } from './blockReasons.js';
import { offerDeadline, hasEnoughNotice, offerMessage, MIN_NOTICE_HOURS } from './offerWindow.js';

// When a booking can no longer happen on its dates — another reservation was
// confirmed over it, or the vehicle was pulled off the road — cancelling and
// refunding used to be the only outcome. It's the right fallback, but it's a
// poor first offer: the client wanted the vehicle, not their money back.
//
// So we look for the nearest dates we could actually honour and let the
// client choose: move, or take the refund. The refund still happens by
// itself if they don't answer, so nobody's deposit sits in limbo.
//
// Two rules keep this from turning into an accounting problem:
//   * every alternative is the SAME LENGTH as the trip they booked, so the
//     long-rental discount can't move; and
//   * an alternative is never priced below what they already agreed to, so
//     moving them can never mean owing money back.
// That leaves one way for the price to change: a date-window promo that
// doesn't reach the new dates falls away, which the client sees before
// they choose.

const DAY = 1000 * 60 * 60 * 24;
const HOUR = 1000 * 60 * 60;
// Three weeks either side of the original pickup. Past that it isn't really
// the same trip any more and a refund is the honest answer.
const MAX_SHIFT_DAYS = 21;
const MAX_OPTIONS = 3;

const when = (d) => new Date(d).toLocaleString('en-US', {
  timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

// Everything that already owns this vehicle's calendar. `extra` covers a
// range that is about to be saved but isn't yet — the blocked range being
// created, or the booking being confirmed this very request — so we can't
// offer dates that are already spoken for by the thing causing the offer.
async function busyRanges(carId, { excludeBookingId, extra = [] } = {}) {
  const query = { car: carId, status: 'confirmed' };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const [bookings, car] = await Promise.all([
    Booking.find(query).select('startDate endDate').lean(),
    Car.findById(carId).select('blockedDates').lean(),
  ]);
  const span = (r) => ({
    start: new Date(r.startDate).getTime(),
    end: new Date(r.endDate).getTime(),
  });
  return [
    ...bookings.map(span),
    ...(car?.blockedDates || []).filter((b) => b.status === 'approved').map(span),
    ...extra.map(span),
  ];
}

// The nearest free ranges of exactly the same length, closest to the
// original pickup first. Later dates are tried before earlier ones at the
// same distance: pushing a trip back is almost always easier for a client
// than pulling it forward, which may already be impossible for them.
export function nearbyRanges(booking, busy, now) {
  const length = new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime();
  const origin = new Date(booking.startDate).getTime();
  const earliest = now.getTime() + MIN_NOTICE_HOURS * HOUR;
  const isFree = (s, e) => !busy.some((r) => s < r.end && e > r.start);

  const found = [];
  for (let days = 1; days <= MAX_SHIFT_DAYS; days++) {
    for (const direction of [1, -1]) {
      const start = origin + direction * days * DAY;
      const end = start + length;
      if (start < earliest || !isFree(start, end)) continue;
      found.push({ startDate: new Date(start), endDate: new Date(end) });
      if (found.length >= MAX_OPTIONS) return found;
    }
  }
  return found;
}

async function priceOptions(car, booking, ranges) {
  const rules = await LongRentalDiscount.find({ active: true }).lean();
  // Pre-discount bookings have subtotal 0 (the field didn't exist), so fall
  // back to what they were actually charged.
  const paidFor = {
    subtotal: booking.subtotal || booking.totalPrice,
    discountAmount: booking.discountAmount || 0,
    totalPrice: booking.totalPrice,
    promoLabel: booking.promoLabel || '',
  };
  return ranges.map((range) => {
    const priced = computeBookingPrice(car, booking.totalDays, range.startDate, range.endDate, rules);
    // Cheaper than the trip they already agreed to — only possible if a promo
    // appeared after they booked. Honour the original price rather than
    // create a refund out of a date change.
    return priced.totalPrice < booking.totalPrice
      ? { ...range, ...paidFor }
      : {
        ...range,
        subtotal: priced.subtotal,
        discountAmount: priced.discountAmount,
        totalPrice: priced.totalPrice,
        promoLabel: priced.promoLabel,
      };
  });
}

// The same search openAdjustOffer runs, without saving anything — so the
// admin's confirmation dialog can say which of the affected clients will be
// offered other dates and which can only be refunded.
export async function previewAlternatives(booking, { extra = [], now = new Date() } = {}) {
  if (!hasEnoughNotice(booking.startDate, now)) return [];
  const busy = await busyRanges(booking.car, { excludeBookingId: booking._id, extra });
  return nearbyRanges(booking, busy, now);
}

// Puts the choice to the client. Returns false when there's nothing to offer
// — too close to pickup, or no free dates nearby — and the caller should
// cancel and refund as before. Never the other way round: a booking is only
// ever left in this state with real options attached to it.
export async function openAdjustOffer(booking, { reason, cause = '', extra = [] } = {}) {
  // Already waiting on this client. Reported as handled so the caller
  // doesn't cancel them, but their deadline and options are left alone —
  // a second knock shouldn't restart the clock they're working to.
  if (booking.adjustOffer?.status === 'open') return true;

  const now = new Date();
  const car = await Car.findById(booking.car);
  if (!car) return false;

  const ranges = await previewAlternatives(booking, { extra, now });
  if (!ranges.length) return false;

  const options = await priceOptions(car, booking, ranges);
  const deadline = offerDeadline(booking.startDate, now);

  booking.adjustOffer = { status: 'open', reason, cause, options, deadline, offeredAt: now };
  await booking.save();

  await notifyUser(
    booking.user,
    'Your booking needs a decision',
    offerMessage({
      reason,
      cause,
      carName: `${car.brand} ${car.model}`,
      totalDays: booking.totalDays,
      optionCount: options.length,
      deadlineText: when(deadline),
    }),
    '/my-bookings'
  );
  return true;
}

// The client picked one of the dates we offered. Re-checked against the
// calendar as it stands right now, because the offer has been sitting there
// for up to a day and anything could have claimed those dates since.
export async function acceptAdjustOffer(booking, optionIndex) {
  const option = booking.adjustOffer?.options?.[optionIndex];
  if (!option) return { ok: false, message: 'That option is no longer available. Please refresh and try again.' };

  const busy = await busyRanges(booking.car, { excludeBookingId: booking._id });
  const start = new Date(option.startDate).getTime();
  const end = new Date(option.endDate).getTime();
  if (busy.some((r) => start < r.end && end > r.start)) {
    return { ok: false, message: 'Those dates have just been taken. Please choose one of the others, or the refund.' };
  }

  booking.startDate = option.startDate;
  booking.endDate = option.endDate;
  booking.subtotal = option.subtotal;
  booking.discountAmount = option.discountAmount;
  booking.totalPrice = option.totalPrice;
  booking.promoLabel = option.promoLabel;
  booking.adjustOffer.status = 'accepted';
  booking.adjustOffer.resolvedAt = new Date();
  // Any reschedule request still sitting on this booking was about dates
  // that no longer exist, and approving it later would move the client a
  // second time.
  if (booking.rescheduleRequest?.status === 'pending') {
    booking.rescheduleRequest.status = 'declined';
    booking.rescheduleRequest.adminNotes = 'Automatically declined: this booking was moved to new dates instead.';
  }
  // As far as admin is concerned this is a fresh request on new dates, so
  // the escalation clock starts again rather than staying where it was.
  booking.confirmReminderTier = 0;
  await booking.save();

  const car = await Car.findById(booking.car).select('brand model');
  await notifyUser(
    booking.user,
    'Your new dates are set',
    `Your ${car ? `${car.brand} ${car.model}` : 'vehicle'} booking has been moved to ${formatTripDates(option.startDate, option.endDate)}.`
      + (booking.status === 'pending' ? ' It is back with our team for confirmation.' : ''),
    '/my-bookings'
  );
  return { ok: true, booking };
}

// The client would rather have their money, or the deadline ran out. Either
// way this is the business's doing, so it's always the full amount — the
// tiered policy prices a client changing their mind, which this isn't.
async function settleWithRefund(booking, { silent }) {
  booking.adjustOffer.status = silent ? 'expired' : 'declined';
  booking.adjustOffer.resolvedAt = new Date();
  return cancelBookingWithRefund(booking, {
    reason: 'vehicle_unavailable',
    cause: booking.adjustOffer.reason === 'booking_conflict'
      ? 'another confirmed reservation'
      : (booking.adjustOffer.cause || 'unforeseen circumstances'),
    extra: silent
      ? 'We offered alternative dates but did not hear back before the deadline, so the refund has gone ahead.'
      : 'You chose the refund over the alternative dates we offered.',
  });
}

export const declineAdjustOffer = (booking) => settleWithRefund(booking, { silent: false });

// Rides along on ordinary requests, the same way the pending-booking
// reminders do — there's no scheduler on the free tier. A client's deposit
// can't be left held indefinitely because nobody happened to load a page,
// so this runs from the admin dashboard poll too.
export async function expireAdjustOffers() {
  try {
    const due = await Booking.find({
      status: { $in: ['pending', 'confirmed'] },
      'adjustOffer.status': 'open',
      'adjustOffer.deadline': { $lte: new Date() },
    });
    for (const booking of due) {
      await settleWithRefund(booking, { silent: true });
    }
  } catch (err) {
    console.error('Adjust-offer expiry sweep failed:', err.message);
  }
}
