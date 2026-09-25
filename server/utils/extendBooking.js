import Car from '../models/Car.js';
import LongRentalDiscount from '../models/LongRentalDiscount.js';
import { computeBookingPrice } from './promo.js';
import { createGcashCheckout, paymongoFetch, refundOnePayment } from './paymongo.js';
import { notifyUser, notifyAdmins } from './notify.js';
import { busySpans, bookingSpan, padded, overlaps } from './availability.js';
import { recordActivity } from './priority.js';
import User from '../models/User.js';
import { licenceProblem, licenceMessage, idProblem } from './documents.js';
import { daysLate, carriedLateFee } from './overdueReturns.js';
import {
  instantFrom, phYmd, phHour, addDays, daysBetween, turnaroundHoursFor, formatMoment,
} from './phTime.js';

// Making a booking longer.
//
// Until now a client who wanted two more days had one option: cancel and
// book again. That costs them their deposit under the refund policy and
// risks losing the vehicle in the gap — for a customer asking to pay MORE.
//
// The price is worked out two different ways, deliberately:
//
//   Before pickup, nothing has happened yet, so it is simply a bigger
//   booking. The whole thing is repriced at its new length, which means a
//   client who crosses a long-rental threshold gets that discount on all
//   of it. It also means they can lose a date-window promo by extending
//   past its last day, which they are told before they pay.
//
//   Once they have the vehicle, the extra days are a separate commitment.
//   They are charged at the standard rate and the booking they already
//   paid for is not repriced — the receipt they hold stays true. The
//   discount is for committing in advance, and extending is not that.
//
// Either way the extension is paid in full before anything moves, and any
// balance already due at pickup is left exactly as it was.

const HOUR = 1000 * 60 * 60;
// How long a started payment holds off being treated as abandoned.
const PAYMENT_GRACE_MINUTES = 30;
// Nothing stops a client extending indefinitely — the user's call — but the
// calendar has to stop somewhere.
const MAX_LOOKAHEAD_DAYS = 120;

const CLIENT_URL = process.env.CLIENT_URL || 'https://rent-a-ride-albay.vercel.app';

// Why this booking can't be made longer, or null when it can. Lives here
// rather than in the route because confirmExtension has to ask the same
// question again when the client comes back from GCash — a booking can be
// cancelled, completed or rescheduled in the minutes somebody spends at a
// payment page, and the answer that let them start is no longer the answer.
export const extendBlocker = (booking, now = new Date()) => {
  if (!['pending', 'confirmed'].includes(booking.status)) return 'This booking cannot be extended.';
  if (booking.payment !== 'paid') return 'This booking has not been paid for yet.';
  if (booking.refundStatus === 'requested') return 'Resolve your refund request before extending this booking.';
  if (booking.rescheduleRequest?.status === 'pending') return 'Resolve your reschedule request before extending this booking.';
  if (booking.adjustOffer?.status === 'open') return 'Choose new dates or a refund on this booking first.';
  // A client who still has the vehicle is not finished, they are late — and
  // telling them to "make a new one" for the car they are sitting in, while
  // charging them a day's rental for every day they keep it, blocks the one
  // cooperative thing they could do. Only a booking whose vehicle actually
  // came back, or never went out, is over.
  const stillOut = !!booking.collectedAt && !booking.returnedAt;
  if (!stillOut && bookingSpan(booking).end <= now) {
    return 'This booking has already ended. Please make a new one.';
  }
  return null;
};

// Whether the client actually has the vehicle. This used to read the clock
// — start <= now — which meant a client an hour late for a 7:00 AM pickup
// was already "collected", and extending then priced their trip as if it
// were underway instead of repricing it whole with any long-rental discount
// they had grown into. It cost them money for being late. Now it is a fact
// somebody recorded, not a guess.
export const hasCollectedVehicle = (booking) => !!booking.collectedAt;

// The last moment this booking could run to before it would tread on
// something else. Other bookings already carry their turnaround in the spans
// this reads, so reaching one of them exactly is as far as it goes.
export async function latestPossibleEnd(booking, now = new Date()) {
  const { spans, turnaroundHours } = await busySpans(booking.car, { excludeBookingId: booking._id });
  const own = bookingSpan(booking);
  // Our own turnaround travels with us, so anything we grow into has to
  // clear it as well.
  const ourEnd = (end) => addDays(end, 0).getTime() + turnaroundHours * HOUR;

  const ahead = spans
    .map((s) => s.start.getTime())
    .filter((t) => t > own.end.getTime())
    .sort((a, b) => a - b);

  // Nothing ahead means nothing is in the way. The lookahead below only
  // exists so the calendar has an end, and must never be reported as though
  // somebody else had the vehicle from that date — which would be a plain
  // untruth dressed up as a limit.
  const constrained = ahead.length > 0;
  const hardStop = constrained ? ahead[0] : addDays(now, MAX_LOOKAHEAD_DAYS).getTime();

  // The return always lands on the pickup hour, so the answer is a day, not
  // a moment: the last day whose return still clears whatever is next.
  const hour = booking.hasPickupTime ? phHour(own.start) : 0;
  let day = phYmd(own.end);
  let best = null;
  for (let i = 1; i <= MAX_LOOKAHEAD_DAYS; i++) {
    const candidate = instantFrom(phYmd(addDays(instantFrom(day, hour), i)), hour);
    if (ourEnd(candidate) > hardStop) break;
    best = candidate;
  }
  return { end: best, constrained };
}

// What an extension to `newEnd` would cost and why, without changing
// anything. The same numbers the client is shown and the ones that get
// applied, so the breakdown can never disagree with the charge.
export async function quoteExtension(booking, newEndYmd, now = new Date()) {
  const car = await Car.findById(booking.car);
  if (!car) return { error: 'That vehicle is no longer available.' };

  // The papers have to cover the longer trip, not the one they booked.
  // Asked at booking and never asked again, so a client could extend past
  // the day their licence runs out and keep driving on it — the one place
  // where the system, rather than a counter, is the only thing checking.
  const client = await User.findById(booking.user).select('licenseNumber licenseExpiry validIdExpiry').lean();

  const own = bookingSpan(booking);
  const hour = booking.hasPickupTime ? phHour(own.start) : 0;
  const newEnd = instantFrom(newEndYmd, hour);
  if (isNaN(newEnd.getTime())) return { error: 'Please choose a valid date.' };
  if (newEnd <= own.end) return { error: 'Pick a date after your current return date.' };

  // Counted from whichever is later: their return date, or today. An
  // overdue client must not be charged rental for days that have already
  // passed AND a late fee for the same days.
  const from = own.end > now ? own.end : now;
  const licence = licenceProblem(client, { bookingType: booking.bookingType, endDate: newEnd }, now);
  if (licence) return { error: licenceMessage(licence) };

  const extraDays = Math.max(1, daysBetween(from, newEnd));
  const newTotalDays = booking.totalDays + extraDays;

  // Lateness they are carrying, and what extending settles it for. Shown
  // whole so they can see the reduction rather than just a smaller number.
  const lateDaysNow = daysLate(booking, now);
  const lateFeeFull = lateDaysNow * car.pricePerDay;
  const lateFeeDue = carriedLateFee(lateDaysNow, car.pricePerDay);

  // The whole booking, with its turnaround, has to fit where it is going.
  const { spans, turnaroundHours } = await busySpans(booking.car, { excludeBookingId: booking._id });
  const wanted = padded({ start: own.start, end: newEnd }, turnaroundHours);
  if (spans.some((s) => overlaps(wanted, s))) {
    return { error: 'The vehicle is not free that far ahead. Please choose an earlier date.' };
  }

  const collected = hasCollectedVehicle(booking);
  const wasTotal = booking.totalPrice;
  const wasSubtotal = booking.subtotal || booking.totalPrice;

  let priced;
  if (collected) {
    // Extra days at the standard rate; what they already paid for is left
    // exactly as it was.
    const extraCost = extraDays * car.pricePerDay;
    priced = {
      subtotal: wasSubtotal + extraCost,
      discountAmount: booking.discountAmount || 0,
      totalPrice: wasTotal + extraCost,
      promoLabel: booking.promoLabel || '',
    };
  } else {
    priced = computeBookingPrice(
      car, newTotalDays, own.start, newEnd,
      await LongRentalDiscount.find({ active: true }).lean(),
    );
  }

  const extensionCost = priced.totalPrice - wasTotal;
  if (extensionCost <= 0) {
    // Cannot normally happen: more days always costs more, and the
    // inversion guard refuses rule sets where a longer trip is cheaper.
    return { error: 'That change does not add anything to this booking.' };
  }

  // How they may pay for it.
  //
  // Once they have the vehicle there is no pickup left to collect a balance
  // at, so the extension is paid outright. Before pickup there is one, and
  // a client part-paying for the booking should be able to part-pay for the
  // extra days too. Charging 100% of the new days while they still owe 80%
  // of the old ones is a rule this system applies nowhere else.
  //
  // Unless they paid the booking off in full, where a deposit has nothing
  // left to mean and the extra days are simply paid the same way.
  const paidInFull = booking.paymentType === 'full' || booking.amountPaid >= wasTotal;
  const canSplit = !collected && !paidInFull;

  const settled = (due) => ({
    dueNow: due,
    balanceAtPickup: Math.max(priced.totalPrice - booking.amountPaid - due, 0),
  });
  // The outstanding fine is settled here rather than left to the counter.
  // They see the full figure and the reduction, and pay the reduced one as
  // part of this, so they walk away owing nothing.
  const payment = {
    options: canSplit ? ['deposit', 'full'] : ['full'],
    deposit: canSplit ? settled(Math.max(Math.ceil(priced.totalPrice * 0.2) - booking.amountPaid, 0) + lateFeeDue) : null,
    full: settled(extensionCost + lateFeeDue),
  };

  return {
    ok: true,
    collected,
    // An ID running out mid-trip warns rather than refuses, as it does at
    // booking — the terms ask for two at the counter, and stranding somebody
    // who already has the vehicle would only turn this into an overdue
    // return instead.
    idExpiring: idProblem(client, { endDate: newEnd }, now)?.expiry || null,
    // Zero for anybody on time, which is almost everybody.
    lateDays: lateDaysNow,
    lateFeeFull,
    lateFeeDue,
    extraDays,
    newTotalDays,
    endDate: newEnd,
    pricePerDay: car.pricePerDay,
    was: { subtotal: wasSubtotal, discountAmount: booking.discountAmount || 0, totalPrice: wasTotal, promoLabel: booking.promoLabel || '' },
    now: priced,
    extensionCost,
    payment,
    // Named so the breakdown can say what changed and why, rather than
    // leaving a client to work out why the number moved.
    discountGained: !booking.promoLabel && !!priced.promoLabel,
    discountLost: !!booking.promoLabel && !priced.promoLabel,
    discountChanged: !!booking.promoLabel && !!priced.promoLabel && booking.promoLabel !== priced.promoLabel,
  };
}

// Hands back a GCash checkout and parks the extension on the booking. The
// dates do not move until confirmExtension sees the payment land, so
// backing out on PayMongo's page costs the client nothing.
export async function startExtension(booking, newEndYmd, mode = 'full') {
  const quote = await quoteExtension(booking, newEndYmd);
  if (!quote.ok) return { ok: false, message: quote.error };

  const chosen = quote.payment.options.includes(mode) ? mode : 'full';
  const amount = quote.payment[chosen].dueNow;
  if (amount <= 0) return { ok: false, message: 'There is nothing to pay for that change.' };

  const car = await Car.findById(booking.car).select('brand model');
  const { id, checkoutUrl } = await createGcashCheckout({
    amount,
    name: `${car ? `${car.brand} ${car.model}` : 'Vehicle'} — ${quote.extraDays} more day${quote.extraDays === 1 ? '' : 's'}`,
    description: `Booking ${booking._id} extension`,
    reference: `${booking._id}-extend-${Date.now()}`,
    metadata: { bookingId: booking._id.toString(), kind: 'extension' },
    successUrl: `${CLIENT_URL}/my-bookings?extend=success&bookingId=${booking._id}`,
    cancelUrl: `${CLIENT_URL}/my-bookings?extend=cancelled&bookingId=${booking._id}`,
  });

  booking.pendingExtension = {
    checkoutSessionId: id,
    amount,
    startedAt: new Date(),
    days: quote.extraDays,
    endDate: quote.endDate,
    totalDays: quote.newTotalDays,
    subtotal: quote.now.subtotal,
    discountAmount: quote.now.discountAmount,
    totalPrice: quote.now.totalPrice,
    promoLabel: quote.now.promoLabel,
    lateDays: quote.lateDays,
    lateAmount: quote.lateFeeDue,
  };
  await booking.save();
  return { ok: true, checkoutUrl };
}

const clearPending = (booking) => {
  booking.pendingExtension = {
    checkoutSessionId: '', amount: 0, startedAt: null, days: 0,
    endDate: null, totalDays: 0, subtotal: 0, discountAmount: 0, totalPrice: 0, promoLabel: '',
    lateDays: 0, lateAmount: 0,
  };
};

// Back from GCash. PayMongo is asked what really happened rather than the
// redirect being trusted — somebody can land on the success URL having
// abandoned the payment.
export async function confirmExtension(booking) {
  const pending = booking.pendingExtension;
  if (!pending?.checkoutSessionId) return { ok: false, message: 'There is no extension waiting on this booking.' };

  const session = await paymongoFetch(`/checkout_sessions/${pending.checkoutSessionId}`);
  const paid = (session.data.attributes.payments || []).find((p) => p.attributes?.status === 'paid');

  if (!paid) {
    const age = Date.now() - new Date(pending.startedAt || 0).getTime();
    // Still inside the window they might be paying in — leave it alone
    // rather than clearing a payment somebody is in the middle of making.
    if (age < PAYMENT_GRACE_MINUTES * 60 * 1000) {
      return { ok: false, message: 'That payment has not come through yet. Your booking is unchanged.' };
    }
    clearPending(booking);
    await booking.save();
    return { ok: false, message: 'That payment was not completed, so your booking is unchanged. You can try again.' };
  }

  // Already recorded — they came back to the page a second time.
  if ((booking.extraPayments || []).some((p) => p.paymongoPaymentId === paid.id)) {
    return { ok: true, booking };
  }

  // The booking closed while they were at GCash. Admin can mark a trip
  // returned or cancel it at any moment, and none of that reaches the
  // client standing at a payment page. Without this the money lands and the
  // days get added to a booking that is already over, which is a trip that
  // does not exist and a payment for nothing.
  //
  // Nothing on a closed booking can carry the amount forward — a cancelled
  // one has already had its refund worked out — so it goes straight back.
  if (!['pending', 'confirmed'].includes(booking.status)) {
    let returned = false;
    try {
      await refundOnePayment({
        paymentId: paid.id,
        amount: pending.amount,
        notes: 'Extension paid after the booking was already closed.',
      });
      returned = true;
    } catch (err) {
      // The refund is what failed, not the payment — we are holding money
      // that isn't ours. Recorded on the booking so it is visible, and put
      // in front of admin rather than left in a log.
      console.error('Refund of a late extension payment failed:', err.message);
      booking.extraPayments.push({ paymongoPaymentId: paid.id, amount: pending.amount, paidAt: new Date() });
      booking.amountPaid += pending.amount;
    }
    clearPending(booking);
    await booking.save();

    await notifyAdmins(
      returned ? 'Extension paid after booking closed' : 'Extension payment needs refunding by hand',
      `A client paid ₱${pending.amount.toLocaleString()} to extend a booking that was already `
        + `${booking.status}. `
        + (returned
          ? 'It has been refunded automatically.'
          : 'The automatic refund failed, so it needs returning through PayMongo by hand.'),
      '/admin/manage-bookings'
    );
    await notifyUser(
      booking.user,
      'Extension could not be applied',
      `That booking had already been closed, so it could not be extended. The ₱${pending.amount.toLocaleString()} you paid `
        + (returned ? 'is being refunded to you.' : 'will be refunded to you — we are arranging it now.'),
      '/my-bookings',
      // Money moved. A line in a bell they may never open is not enough.
      { email: true }
    );
    return {
      ok: false,
      message: returned
        ? `This booking had already been closed, so it could not be extended. The ₱${pending.amount.toLocaleString()} you paid is being refunded.`
        : `This booking had already been closed, so it could not be extended. We are arranging the refund of your ₱${pending.amount.toLocaleString()} now.`,
    };
  }

  // Re-checked at the last moment: the offer was made against a calendar
  // that may have changed while they were paying.
  const { spans, turnaroundHours } = await busySpans(booking.car, { excludeBookingId: booking._id });
  const wanted = padded({ start: bookingSpan(booking).start, end: new Date(pending.endDate) }, turnaroundHours);
  const clash = spans.some((s) => overlaps(wanted, s));

  booking.extraPayments.push({ paymongoPaymentId: paid.id, amount: pending.amount, paidAt: new Date() });
  booking.amountPaid += pending.amount;

  if (clash) {
    // Their money is in and the days are not. Recorded against the booking
    // so it comes back with any refund, and flagged for admin rather than
    // passing silently.
    clearPending(booking);
    await booking.save();
    await notifyAdmins(
      'Extension paid but dates unavailable',
      `A client paid ₱${pending.amount.toLocaleString()} to extend a booking and the days went before it landed. `
        + 'The amount is on their booking and comes back with any refund they take.',
      '/admin/manage-bookings'
    );
    return { ok: false, message: 'Those extra days were taken while your payment went through. Nothing has changed, and the amount you paid is on your booking — please contact us.' };
  }

  // Settled, so it survives the end date moving past the days they were
  // late for. Recorded only now that the money has actually landed.
  if (pending.lateDays > 0) {
    booking.lateFee.carriedDays = (booking.lateFee.carriedDays || 0) + pending.lateDays;
    booking.lateFee.carriedAmount = (booking.lateFee.carriedAmount || 0) + pending.lateAmount;
    booking.lateFee.collectedAt = new Date();
  }

  const previousEndDate = booking.endDate;
  booking.endDate = pending.endDate;
  booking.totalDays = pending.totalDays;
  booking.subtotal = pending.subtotal;
  booking.discountAmount = pending.discountAmount;
  booking.totalPrice = pending.totalPrice;
  booking.promoLabel = pending.promoLabel;
  booking.extensions.push({
    days: pending.days,
    amount: pending.amount,
    previousEndDate,
    addedAt: new Date(),
  });
  clearPending(booking);
  recordActivity(booking, 'client', `extended to ${formatMoment(booking.endDate, booking.hasPickupTime)}`);
  await booking.save();

  const car = await Car.findById(booking.car).select('brand model');
  await notifyUser(
    booking.user,
    'Booking extended',
    `Your ${car ? `${car.brand} ${car.model}` : 'vehicle'} booking now runs to `
      + `${formatMoment(booking.endDate, booking.hasPickupTime)}.`,
    '/my-bookings',
    { email: true }
  );
  await notifyAdmins(
    'Booking Extended',
    `A client extended a booking by ${pending.days} day${pending.days === 1 ? '' : 's'} and paid ₱${pending.amount.toLocaleString()}.`,
    '/admin/manage-bookings'
  );

  return { ok: true, booking };
}
