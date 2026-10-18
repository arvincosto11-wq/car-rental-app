// What a client's own booking says about itself.
//
// My Bookings used to be a flat list of status words — Pending, Upcoming,
// Completed, Cancelled — which are the office's categories, not a
// customer's question. A customer asks two things: what do I have to do,
// and what happened. So every booking resolves here to a tone, a sentence
// in plain words, a step along the way, and one shape for the money.
//
// All of it derived, none of it stored. Every input is already on the
// booking by the time a client can see it.

import { hoursLate, latenessLabel, overdueLabel } from './lateness.js';
import { isOfferOpen } from './offerWindow.js';
import { isOverdue, daysOverdue } from './overdue.js';
import { payableNow } from './settlement.js';

const peso = (n) => `₱${Math.round(Math.abs(n || 0)).toLocaleString('en-US')}`;

// ── what still has to be paid ────────────────────────────────────────
//
// A charge counts as owed until somebody marks it collected. The rental
// itself is owed up to whatever has been paid against it.
const unsettled = (b) => (
  (!b.lateFee?.collectedAt ? (b.lateFee?.amount || 0) : 0)
  + (!b.fuel?.collectedAt ? (b.fuel?.charge || 0) : 0)
  + (!b.condition?.damageCollectedAt ? (b.condition?.damageCharge || 0) : 0)
);

// The fine as it stands right now on a vehicle still out, before anybody
// has written it down. One day's rental per day of delay, plus lateness
// already settled by extending — the same rule and the same arithmetic as
// lateFeeSoFar in adminToday.js, so a client is quoted the figure the
// counter is going to charge them, not a friendlier one.
const lateDaysSoFar = (b, now) => (isOverdue(b, now) ? daysOverdue(b, now) : 0);
const lateFeeSoFar = (b, now) => (
  isOverdue(b, now)
    ? daysOverdue(b, now) * (b.car?.pricePerDay || 0) + (b.lateFee?.carriedAmount || 0)
    : 0
);

export function moneyFor(b, now = new Date()) {
  const days = b.totalDays || 1;
  // What the rental actually cost, taken from the booking rather than
  // from the vehicle's price today. Editing a vehicle's daily rate must
  // not rewrite the receipt of a trip somebody already took — the model
  // says as much about totalPrice: "this receipt can't change".
  //
  // totalPrice already has the discount taken off and the delivery added,
  // so putting those back gives the rental on its own. That also makes
  // the lines add up to totalPrice, which is the figure `owe` is worked
  // out from; using the vehicle's current rate made the two disagree.
  const rentalTotal = Math.max(0, (b.totalPrice || 0) - (b.deliveryFee || 0) + (b.discountAmount || 0));
  const rate = days ? rentalTotal / days : 0;
  const lines = [];

  if (rentalTotal) lines.push({ label: `${days} day${days === 1 ? '' : 's'} × ${peso(rate)}`, amount: rentalTotal });
  if (b.deliveryFee) lines.push({ label: 'Delivery', amount: b.deliveryFee });
  // A discount is money the client never has to find, so it reads as a
  // subtraction rather than as a smaller total with no explanation.
  if (b.discountAmount) {
    lines.push({ label: b.promoLabel || 'Discount', amount: -b.discountAmount, kind: 'off' });
  }
  if (b.lateFee?.amount) {
    lines.push({
      label: `Late fee · ${latenessLabel(hoursLate(b.endDate, b.returnedAt), b.lateFee.days).replace('Returned ', '')}`,
      amount: b.lateFee.amount,
      kind: 'fee',
    });
  }
  // Once the vehicle is back the fee is recorded above. Until then it is
  // still running, and a receipt that stays silent about it lets a client
  // believe the trip costs what it cost yesterday.
  const accruing = b.lateFee?.amount ? 0 : lateFeeSoFar(b, now);
  if (accruing) {
    // Named with the days it is charged on. The sentence above says how
    // late the vehicle IS — whole days elapsed — while the fee counts
    // every day started, so a vehicle 2 days and 3 hours over reads "2
    // days late" and costs three. Both are right; side by side and
    // unexplained they look like an overcharge.
    const days = lateDaysSoFar(b, now);
    lines.push({
      label: `Late fee so far · ${days} day${days === 1 ? '' : 's'}`,
      amount: accruing,
      kind: 'fee',
    });
  }
  if (b.fuel?.charge) lines.push({ label: 'Fuel', amount: b.fuel.charge, kind: 'fee' });
  if (b.condition?.damageCharge) lines.push({ label: 'Damage', amount: b.condition.damageCharge, kind: 'fee' });

  const cost = lines.reduce((sum, l) => sum + l.amount, 0);
  const paid = b.amountPaid || 0;
  const back = b.refundStatus === 'approved' ? (b.refundAmount || 0) : 0;
  // A cancelled booking owes nothing: whatever was paid is either coming
  // back or it is not, and either way nobody is collecting more.
  const owe = b.status === 'cancelled'
    ? 0
    : Math.max(0, (b.totalPrice || 0) - paid) + unsettled(b) + accruing;

  return { lines, cost, paid, owe, back, oweWhen: oweWhen(b) };
}

const oweWhen = (b) => {
  if (b.status === 'completed') return 'now';
  if (b.collectedAt) return 'when you return it';
  return 'at pickup';
};

// The one line used where a booking is only a row.
export function moneySummary(money) {
  if (!money.paid && !money.owe) return 'Nothing was charged';
  if (money.owe) return `${peso(money.cost)} · ${peso(money.owe)} to pay ${money.oweWhen}`;
  if (money.back) return `${peso(money.paid)} paid · ${peso(money.back)} came back`;
  return `${peso(money.cost)} · all paid`;
}

// ── where it has got to ──────────────────────────────────────────────
export function stepOf(b) {
  if (b.returnedAt || b.status === 'completed') return 3;
  if (b.collectedAt) return 2;
  if (b.status === 'confirmed') return 1;
  return 0;
}

// ── how loudly it should speak ───────────────────────────────────────
//
// Red is something gone wrong, amber something to do, green something in
// hand, wait something the office owes an answer on, done settled.
export function toneOf(b, now = new Date()) {
  const out = !!b.collectedAt && !b.returnedAt;
  if (out && new Date(b.endDate) < new Date(now)) return 'red';
  if (b.status === 'cancelled' && b.refundStatus === 'declined') return 'red';

  if (isOfferOpen(b.adjustOffer, now)) return 'amber';
  if (b.payment === 'gcash_pending') return 'amber';
  if (b.status === 'completed' && unsettled(b) > 0) return 'amber';
  if (b.status === 'completed' && !b.carRating?.rating) return 'amber';

  if (b.status === 'pending') return 'wait';
  if (b.rescheduleRequest?.status === 'pending') return 'wait';
  if (b.status === 'cancelled' && b.refundStatus === 'requested') return 'wait';

  if (b.status === 'confirmed') return 'ok';
  return 'done';
}

// ── is this still going on, or is it history? ────────────────────────
//
// Anything waiting on the client or on the office is live. A trip that
// finished and was paid for is history even if it has not been rated —
// an unrated trip is worth a nudge, not a place at the top of the page.
export function isLive(b, now = new Date()) {
  if (b.status === 'pending' || b.status === 'confirmed') return true;
  if (isOfferOpen(b.adjustOffer, now)) return true;
  if (b.status === 'completed') return moneyFor(b, now).owe > 0;
  if (b.status === 'cancelled') return b.refundStatus === 'requested';
  return false;
}

// ── what it says ─────────────────────────────────────────────────────
const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const dayOf = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export function sentenceFor(b, now = new Date()) {
  const money = moneyFor(b, now);

  if (b.status === 'cancelled') {
    if (b.refundStatus === 'requested') return 'You asked for a refund — the office is deciding';
    if (b.refundStatus === 'declined') return 'Cancelled — refund declined';
    if (money.back) return `Cancelled — ${peso(money.back)} refunded`;
    if (!money.paid) return 'Cancelled — nothing was charged';
    return 'Cancelled — you haven’t asked for a refund';
  }

  if (isOfferOpen(b.adjustOffer, now)) {
    return `${b.car?.model || 'That vehicle'} isn’t free on those dates — pick new dates or a full refund`;
  }

  if (b.status === 'completed') {
    const late = hoursLate(b.endDate, b.returnedAt);
    const how = late > 0 ? latenessLabel(late, b.lateFee?.days).replace('Returned ', 'Returned ') : 'Returned on time';
    if (money.owe) return `${how} — ${peso(money.owe)} left to pay`;
    if (!b.carRating?.rating) return `${how} · not rated yet`;
    return `${how} · you gave it ${b.carRating.rating} star${b.carRating.rating === 1 ? '' : 's'}`;
  }

  const out = !!b.collectedAt && !b.returnedAt;
  if (out) {
    if (new Date(b.endDate) < new Date(now)) {
      return `Due back at ${timeOf(b.endDate)} — ${overdueLabel(hoursLate(b.endDate, now), b.lateFee?.days).replace(' overdue', ' late')}`;
    }
    return `Out with you — due back ${sameDay(b.endDate, now) ? `today at ${timeOf(b.endDate)}` : dayOf(b.endDate)}`;
  }

  if (b.payment === 'gcash_pending') return 'Your GCash payment didn’t finish';
  if (b.rescheduleRequest?.status === 'pending') return 'You asked for new dates — waiting for the office';
  if (b.refundStatus === 'requested') return 'You asked for a refund — the office is deciding';
  if (b.status === 'pending') return 'Waiting for the office to confirm';

  if (sameDay(b.startDate, now)) return `Pick up today at ${timeOf(b.startDate)}`;
  return `Confirmed — pick up ${dayOf(b.startDate)}`;
}

// ── what the client can do about it ──────────────────────────────────
//
// Only what this booking actually allows. A client never cancels: they
// ask, and the office decides.
export function actionKeysFor(b, now = new Date()) {
  const keys = [];
  const out = !!b.collectedAt && !b.returnedAt;

  if (isOfferOpen(b.adjustOffer, now)) return ['offer'];
  if (b.payment === 'gcash_pending') return ['pay'];

  if (out) {
    keys.push('longer');
    keys.push('call');
    return keys;
  }

  if (b.status === 'completed') {
    // Not 'pay', which finishes an abandoned checkout and refuses a
    // booking already marked paid. Settling is its own thing, for its
    // own amount — see payableNow.
    if (payableNow(b).amount > 0) keys.push('settle');
    if (!b.carRating?.rating) keys.push('rate');
    keys.push('call');
    return keys;
  }

  if (b.status === 'cancelled') {
    if (!b.refundStatus || b.refundStatus === 'none') keys.push('refund');
    return keys;
  }

  // Still ahead of us: the dates can be questioned and the money asked
  // back, until the keys change hands.
  if (payableNow(b).amount > 0) keys.push('settle');
  if (!b.rescheduleRequest || b.rescheduleRequest.status !== 'pending') keys.push('dates');
  if (!b.refundStatus || b.refundStatus === 'none') keys.push('refund');
  return keys;
}

// ── the line under the steps ─────────────────────────────────────────
//
// The sentence above says what state the booking is in; this says what
// that means for the client — what a fee costs, what to bring, what
// happens if the office stays quiet. Every one of them is built out of
// what the booking already carries, so a state we cannot explain from the
// record gets no line rather than a guess.
const feeWords = (lines) => {
  const fees = lines.filter((l) => l.kind === 'fee');
  // 'Late fee · 6 h late' is a receipt label; in a sentence it is a late fee.
  const said = fees.map((l) => `${peso(l.amount)} ${l.label.split(' · ')[0].toLowerCase()}`);
  if (said.length === 0) return '';
  if (said.length === 1) return said[0];
  return `${said.slice(0, -1).join(', ')}, plus ${said[said.length - 1]}`;
};

export function subFor(b, now = new Date()) {
  const rate = b.car?.pricePerDay || 0;
  const money = moneyFor(b, now);
  const out = !!b.collectedAt && !b.returnedAt;

  if (isOfferOpen(b.adjustOffer, now)) {
    const pick = b.adjustOffer.options?.[0];
    const by = b.adjustOffer.deadline ? ` Please answer by ${dayOf(b.adjustOffer.deadline)}.` : '';
    if (pick?.startDate) return `The office offered ${dayOf(pick.startDate)} → ${dayOf(pick.endDate)}.${by}`;
    return `Nothing is charged either way.${by}`;
  }

  if (b.status === 'cancelled') {
    if (b.refundStatus === 'requested') return 'They’ll tell you how much comes back.';
    if (b.refundStatus === 'declined') return money.paid ? `The ${peso(money.paid)} that was paid was kept.` : '';
    if (!money.paid) return 'Nothing was charged.';
    return '';
  }

  if (b.status === 'completed') {
    const fees = feeWords(money.lines);
    if (money.owe > 0 && fees) return `That is ${fees}.`;
    if (!b.carRating?.rating) return 'A rating takes a moment, and it’s what the next client goes on.';
    return '';
  }

  if (out) {
    if (isOverdue(b, now)) {
      return `The late fee is one day’s rental (${peso(rate)}) for every day it’s late.`
        + ' Bring it back, or ask to keep it longer.';
    }
    return `Returning late adds one day’s rental (${peso(rate)}) for each day.`;
  }

  if (b.payment === 'gcash_pending') return 'Nothing has been charged yet.';
  if (b.rescheduleRequest?.status === 'pending') {
    return `Until they answer, it stays on ${dayOf(b.startDate)} → ${dayOf(b.endDate)}.`;
  }
  if (b.refundStatus === 'requested') return 'Asking doesn’t cancel it. The office decides how much comes back.';
  if (b.status === 'pending') return 'You’ll get a notification as soon as the office answers.';

  // Confirmed, and the pickup still ahead.
  if (money.owe > 0) return `Bring your driver’s license and ${peso(money.owe)} for the balance.`;
  return 'Bring your driver’s license when you pick it up.';
}
