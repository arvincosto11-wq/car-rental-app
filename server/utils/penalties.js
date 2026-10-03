// Letting somebody off a charge, without pretending it never happened.
//
// Three different things can be owed after a rental — a late fee, a
// refuelling charge, a damage bill — and until now each was all-or-nothing:
// collect it, or leave it showing as a debt forever. Neither is what a
// business actually does. Somebody breaks down through no fault of theirs,
// somebody is an hour late because the road was shut, somebody has rented
// from you forty times. The answer is to waive it.
//
// The waiver is recorded rather than applied by deletion. Zeroing the
// charge would lose what it was, who decided, and why — and the first
// question anybody asks about a forgiven debt is who forgave it. So the
// gross figure stays exactly as it was and the waiver sits beside it:
//
//     gross 3,248 · waived 3,248 · payable 0
//
// Partial is allowed because half is a real answer. "I'll let you off the
// weekend but not the three days" is a conversation that happens, and a
// system that only understands all-or-nothing pushes it off the books.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/penalties.js). The amount shown as owed, the button that
// collects it, and the server that records it all have to agree on what is
// left to pay.

export const PENALTY_KINDS = ['late_fee', 'fuel', 'damage'];

// Which fields on a booking hold each charge. Written once here so adding a
// fourth kind of charge later is one entry, not a search through every
// screen that mentions money.
const FIELDS = {
  late_fee: { owner: 'lateFee', gross: 'amount', collected: 'collectedAt', noun: 'late fee' },
  fuel: { owner: 'fuel', gross: 'charge', collected: 'collectedAt', noun: 'refuelling charge' },
  damage: { owner: 'condition', gross: 'damageCharge', collected: 'damageCollectedAt', noun: 'damage charge' },
};

// Why it was let off. A list rather than free text, for the same reason
// cancellations use one: "goodwill" written forty different ways cannot be
// counted, and at the end of a year somebody will want to know how much was
// waived and what for. The note carries the specifics.
export const WAIVE_REASONS = [
  { value: 'our_fault', label: 'Our fault' },
  { value: 'outside_control', label: 'Outside their control' },
  { value: 'goodwill', label: 'Goodwill' },
  { value: 'settled_elsewhere', label: 'Settled another way' },
  { value: 'charged_in_error', label: 'Charged in error' },
];

export const isWaiveReason = (value) => WAIVE_REASONS.some((r) => r.value === value);

export const waiveReasonLabel = (value) =>
  WAIVE_REASONS.find((r) => r.value === value)?.label || '';

export const penaltyNoun = (kind) => FIELDS[kind]?.noun || 'charge';

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// Everything any screen needs to know about one charge.
//
//   gross      what it came to in the first place, never reduced
//   waived     how much of it was let off
//   payable    what is actually owed
//   settled    the money arrived
//   outstanding there is still something to collect
//
// A charge of zero is not a charge: nothing to collect, nothing to waive,
// and no row to draw.
export function penaltyState(booking, kind) {
  const f = FIELDS[kind];
  if (!f) return null;
  const owner = booking?.[f.owner] || {};
  const gross = num(owner[f.gross]);
  // Clamped on the way out as well as on the way in. A waiver bigger than
  // the charge would otherwise show a negative amount owed, which reads as
  // the business owing the client money.
  const waived = Math.min(Math.max(num(owner.waivedAmount), 0), gross);
  const collectedAt = owner[f.collected] || null;

  return {
    kind,
    noun: f.noun,
    gross,
    waived,
    payable: gross - waived,
    exists: gross > 0,
    settled: !!collectedAt,
    collectedAt,
    waivedAt: owner.waivedAt || null,
    waivedReason: owner.waivedReason || '',
    waivedNote: owner.waivedNote || '',
    waivedFully: gross > 0 && waived >= gross,
    waivedPartly: waived > 0 && waived < gross,
    outstanding: gross - waived > 0 && !collectedAt,
  };
}

// Where to write a waiver. Returns the paths rather than mutating, so the
// route stays the only thing that touches the document.
export function penaltyPaths(kind) {
  const f = FIELDS[kind];
  if (!f) return null;
  return { owner: f.owner, gross: f.gross, collected: f.collected };
}

// Whether this charge can be let off at all, and the sentence to show when
// it cannot. Said here so the button, the route and the admin screen give
// one answer rather than three.
export function waiveBlocker(booking, kind, amount) {
  const state = penaltyState(booking, kind);
  if (!state) return 'That is not a charge we recognise.';
  if (!state.exists) return `There is no ${state.noun} on this booking.`;
  // Money that has already changed hands is a refund, not a waiver, and
  // refunds go back the way they came.
  if (state.settled) return `That ${state.noun} has already been collected. Refund it instead of waiving it.`;
  if (state.waived > 0) return `That ${state.noun} has already been reduced. Undo the existing waiver first.`;
  const asked = num(amount);
  if (asked <= 0) return 'Say how much to let off.';
  if (asked > state.gross) return `That is more than the ${state.noun} itself.`;
  return null;
}

// What the admin screen prints next to the figure.
export function waiveSummary(state) {
  if (!state?.waived) return '';
  const who = state.waivedReason ? waiveReasonLabel(state.waivedReason).toLowerCase() : 'waived';
  return state.waivedFully ? `waived — ${who}` : `₱${state.waived.toLocaleString()} off — ${who}`;
}
