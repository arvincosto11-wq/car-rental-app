import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import LongRentalDiscount from '../models/LongRentalDiscount.js';
import { computeBookingPrice } from './promo.js';
import { cancelBookingWithRefund } from './cancelBooking.js';
import { createGcashCheckout, paymongoFetch } from './paymongo.js';
import { notifyUser, notifyAdmins } from './notify.js';
import { formatTripDates } from './blockReasons.js';
import { offerDeadline, hasEnoughNotice, offerMessage, MIN_NOTICE_HOURS } from './offerWindow.js';
import { busySpans, bookingSpan, overlaps } from './availability.js';
import { instantFrom, phHour, isTradingHour } from './phTime.js';

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
// How long a started top-up payment holds off the expiry sweep. Long enough
// to finish paying on GCash, short enough that an abandoned one still
// refunds itself rather than sitting on a client's money indefinitely.
const TOP_UP_GRACE_MINUTES = 30;

const CLIENT_URL = process.env.CLIENT_URL || 'https://rent-a-ride-albay.vercel.app';

// Nothing is owed at pickup on this booking, so a price rise has no balance
// to join and has to be collected before the dates move.
const settledInFull = (booking) => booking.payment === 'paid' && booking.amountPaid >= booking.totalPrice;

const when = (d) => new Date(d).toLocaleString('en-US', {
  timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

// The nearest free ranges of exactly the same length, closest to the
// original pickup first. Later dates are tried before earlier ones at the
// same distance: pushing a trip back is almost always easier for a client
// than pulling it forward, which may already be impossible for them.
//
// Shifting by whole days keeps the client's own pickup hour, so an offered
// slot is always a time they could actually be served at. `busy` already
// carries each booking's turnaround, so nothing offered lands in the gap a
// vehicle needs between customers.
export function nearbyRanges(booking, busy, now) {
  const own = bookingSpan(booking);
  const length = own.end.getTime() - own.start.getTime();
  const origin = own.start.getTime();
  const earliest = now.getTime() + MIN_NOTICE_HOURS * HOUR;

  const found = [];
  for (let days = 1; days <= MAX_SHIFT_DAYS; days++) {
    for (const direction of [1, -1]) {
      const startDate = new Date(origin + direction * days * DAY);
      const endDate = new Date(startDate.getTime() + length);
      if (startDate.getTime() < earliest) continue;
      if (busy.some((b) => overlaps({ start: startDate, end: endDate }, b))) continue;
      found.push({ startDate, endDate });
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
  const { spans } = await busySpans(booking.car, { excludeBookingId: booking._id, extraBlocks: extra });
  return nearbyRanges(booking, spans, now);
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
    '/my-bookings',
    // The one that most needs to leave the site. It expires, and a client
    // who doesn't see it in time is refunded and loses the trip — relying
    // on them opening the page inside a day is optimistic.
    { email: true }
  );
  return true;
}

// Moves a booking onto dates the client has settled on. Shared by the
// suggested options and by dates they picked themselves.
//
// The price is re-checked here rather than trusted: an alternative can cost
// more than the trip they agreed to, because a date-window promo may not
// reach the new dates. Nobody is moved onto a bigger bill without saying so
// first, so a rise is refused until the client has seen the figure and
// confirmed it — the same shape as the promo and blocked-date confirmations
// elsewhere in the app.
async function applyOption(booking, option, { confirmPrice = false, paidUpfront = false, payAtPickup = false } = {}) {
  // Availability first, deliberately: there is no point putting a price to
  // someone for dates we can no longer give them. The offer has been
  // sitting there for up to a day and anything could have claimed them.
  const { spans } = await busySpans(booking.car, { excludeBookingId: booking._id });
  const wanted = { start: new Date(option.startDate), end: new Date(option.endDate) };
  if (spans.some((b) => overlaps(wanted, b))) {
    return { ok: false, message: 'Those dates have just been taken. Please choose one of the others, or the refund.' };
  }

  const extra = option.totalPrice - booking.totalPrice;
  if (extra > 0) {
    const payUpfront = settledInFull(booking);
    // A client who still owes something at pickup just owes a little more,
    // and confirming the figure is the whole of it.
    //
    // One who has already settled has no balance for it to join, so they
    // are asked how they would rather handle it: pay now by GCash, which
    // arrives here as paidUpfront once the money has actually landed, or
    // bring it at pickup, which arrives as payAtPickup and simply opens a
    // balance on a booking that had none. Either is an explicit answer —
    // what isn't allowed is moving them silently.
    const answered = payUpfront ? (paidUpfront || payAtPickup) : confirmPrice;
    if (!answered) {
      return {
        ok: false,
        needsPriceConfirmation: true,
        payUpfront,
        extra,
        newTotal: option.totalPrice,
        wasTotal: booking.totalPrice,
        promoLabel: booking.promoLabel || '',
        startDate: option.startDate,
        endDate: option.endDate,
        message: `These dates cost ₱${extra.toLocaleString()} more than your booking.`,
      };
    }
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

// Clearing a nested object by assigning undefined doesn't reliably stick in
// Mongoose, and a stale checkout id here would keep the expiry sweep off a
// booking that is no longer paying for anything. Blanked field by field.
const clearTopUp = (booking) => {
  booking.adjustOffer.topUp = {
    checkoutSessionId: '', amount: 0, startedAt: null, option: {},
  };
};

// Which dates the client has settled on: one of the three we suggested, or
// a day they picked themselves. A date of their own keeps the trip's length
// and its pickup hour — only where it sits moves — so it's priced by the
// same function and gets the same treatment from there on.
async function resolveOption(booking, { optionIndex, startDate, pickupHour }) {
  if (!startDate) {
    const option = booking.adjustOffer?.options?.[Number(optionIndex)];
    if (!option) return { error: 'That option is no longer available. Please refresh and try again.' };
    return { option };
  }

  const car = await Car.findById(booking.car);
  if (!car) return { error: 'That vehicle is no longer available.' };

  const own = bookingSpan(booking);
  // Their own hour unless they picked another one. That fallback is what
  // this used to do always — and it meant a client could be told their
  // dates were taken when the truth was that only their old hour was,
  // with the rest of that day sitting free.
  //
  // Only offered on a booking that has a pickup time at all. One made
  // before times existed stays a whole-day booking rather than quietly
  // growing an hour it was never made with.
  const chosen = Number(pickupHour);
  const hour = booking.hasPickupTime
    ? (isTradingHour(chosen) ? chosen : phHour(booking.startDate))
    : 0;
  if (booking.hasPickupTime && pickupHour !== undefined && pickupHour !== null && !isTradingHour(chosen)) {
    return { error: 'Please choose a pickup time between 7:00 AM and 8:00 PM.' };
  }
  const start = instantFrom(startDate, hour);
  if (isNaN(start.getTime())) return { error: 'Please choose a valid date.' };
  if (start.getTime() < Date.now() + MIN_NOTICE_HOURS * HOUR) {
    return { error: 'Please choose a date a little further ahead — we need time to have the vehicle ready.' };
  }

  const end = new Date(start.getTime() + (own.end.getTime() - own.start.getTime()));
  const [option] = await priceOptions(car, booking, [{ startDate: start, endDate: end }]);
  return { option };
}

// The client picked their dates. Re-checked against the calendar as it
// stands right now, because the offer has been sitting there for up to a
// day and anything could have claimed those dates since.
export async function acceptAdjustOffer(booking, choice, opts) {
  const { option, error } = await resolveOption(booking, choice);
  if (error) return { ok: false, message: error };
  return applyOption(booking, option, opts);
}

// The client had already settled this booking in full, and the dates they
// want cost more. There is no pickup balance for the difference to join, so
// it is collected first: this hands back a GCash checkout and parks the
// chosen dates on the booking. They do not move until confirmTopUp sees the
// payment land, so backing out of GCash changes nothing.
export async function startTopUp(booking, choice) {
  const { option, error } = await resolveOption(booking, choice);
  if (error) return { ok: false, message: error };

  const { spans } = await busySpans(booking.car, { excludeBookingId: booking._id });
  if (spans.some((b) => overlaps({ start: new Date(option.startDate), end: new Date(option.endDate) }, b))) {
    return { ok: false, message: 'Those dates have just been taken. Please choose one of the others, or the refund.' };
  }

  const extra = option.totalPrice - booking.totalPrice;
  if (extra <= 0) return { ok: false, message: 'There is nothing extra to pay on those dates.' };

  const car = await Car.findById(booking.car).select('brand model');
  const { id, checkoutUrl } = await createGcashCheckout({
    amount: extra,
    name: `${car ? `${car.brand} ${car.model}` : 'Vehicle'} \u2014 new dates`,
    description: `Booking ${booking._id} date change`,
    reference: `${booking._id}-topup-${Date.now()}`,
    metadata: { bookingId: booking._id.toString(), kind: 'adjust-top-up' },
    successUrl: `${CLIENT_URL}/my-bookings?topup=success&bookingId=${booking._id}`,
    cancelUrl: `${CLIENT_URL}/my-bookings?topup=cancelled&bookingId=${booking._id}`,
  });

  booking.adjustOffer.topUp = { checkoutSessionId: id, amount: extra, startedAt: new Date(), option };
  await booking.save();
  return { ok: true, checkoutUrl };
}

// Back from GCash. PayMongo is asked what actually happened rather than the
// redirect being trusted — someone can land on the success URL having
// abandoned the payment.
export async function confirmTopUp(booking) {
  const topUp = booking.adjustOffer?.topUp;
  if (!topUp?.checkoutSessionId) return { ok: false, message: 'There is no payment waiting on this booking.' };

  const session = await paymongoFetch(`/checkout_sessions/${topUp.checkoutSessionId}`);
  const paid = (session.data.attributes.payments || []).find((p) => p.attributes?.status === 'paid');

  if (!paid) {
    // Backed out, or it expired. Cleared so they can choose again — nothing
    // about the booking has changed.
    clearTopUp(booking);
    await booking.save();
    return { ok: false, message: 'That payment was not completed, so your booking is unchanged. You can choose again.' };
  }

  // Already recorded — they came back to the page a second time.
  if ((booking.extraPayments || []).some((p) => p.paymongoPaymentId === paid.id)) {
    return { ok: true, booking };
  }

  // Copied out, not referenced. topUp.option is a live view into the
  // nested document, so clearing the top-up below empties it — and the
  // dates would then be written back as nothing, which the schema rejects
  // with "startDate is required" long after the client has paid.
  const option = typeof topUp.option?.toObject === 'function'
    ? topUp.option.toObject()
    : { ...topUp.option };

  booking.extraPayments.push({ paymongoPaymentId: paid.id, amount: topUp.amount, paidAt: new Date() });
  booking.amountPaid += topUp.amount;
  clearTopUp(booking);

  const result = await applyOption(booking, option, { paidUpfront: true });
  if (!result.ok) {
    // Their money is in and the dates are not. The payment stays recorded,
    // so taking the refund now returns it along with the rest — but admin
    // needs to know a client is sitting in this state.
    await booking.save();
    await notifyAdmins(
      'Top-up taken but dates unavailable',
      `A client paid \u20b1${topUp.amount.toLocaleString()} to move a booking and the dates went before it landed. `
        + 'Their offer is still open, and the amount comes back with any refund they take.',
      '/admin/manage-bookings'
    );
  }
  return result;
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
      // Someone mid-payment for new dates is not ignoring us. Refunding them
      // while GCash is open would take the booking out from under a client
      // who is in the middle of keeping it.
      const startedAt = booking.adjustOffer?.topUp?.startedAt;
      if (startedAt && Date.now() - new Date(startedAt).getTime() < TOP_UP_GRACE_MINUTES * 60 * 1000) continue;
      await settleWithRefund(booking, { silent: true });
    }
  } catch (err) {
    console.error('Adjust-offer expiry sweep failed:', err.message);
  }
}
