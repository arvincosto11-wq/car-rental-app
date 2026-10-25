// What the vehicle's owner is paid for a booking, and what the business keeps.
//
// Until now there was no split at all: a consignor was credited the whole
// rental, so the system said the business earned nothing for running it.
// That was never the arrangement, just the absence of one.
//
// Two rules hold this file together, and both exist to stop money moving
// after the fact.
//
// FIRST: the agreed percentage is recorded ON THE BOOKING as it is made,
// never read from settings when somebody opens a report. Settings are meant
// to be changed — that is the point of them — and a report that multiplies
// last year's rentals by this year's rate would quietly restate every
// payout already made. The booking carries the terms it was made under, the
// same way it already carries the promo it was sold under and the delivery
// fee it was quoted.
//
// A booking with nothing recorded is left on the terms it was made under:
// the whole rental to the owner. Those are the bookings that predate any
// agreement, and they are not retrospectively put onto a deal nobody had
// struck yet.
//
// SECOND: the split is taken from the RENTAL only. Delivery, late fees,
// fuel and damage charges are collected to cover what the business spends
// on those things — the owner does not drive the delivery van or repair the
// dent — and the deposit is just part of the rental paid early, not extra
// money. This matches how vehicle-rental management is done locally, where
// the management fee is quoted against base rental revenue rather than
// everything a renter hands over.
//
// This file has no imports so the server keeps an identical copy (see
// server/utils/revenueShare.js). The consignor's dashboard, the admin
// income panel and the server all have to reach the same peso.

// The owner's side of a new agreement, in per cent.
//
// 80/20 follows the published terms of Philippine rental-management
// operators, who take a fifth of base rental revenue for running the
// vehicle. It is a starting point held in settings, not a law: admin can
// change it, and from then on new bookings carry the new number while old
// ones keep theirs.
export const DEFAULT_OWNER_PERCENT = 80;

// Whole per cent, 0 to 100. A share of 99.7% is not a thing anybody agreed
// to, and halves of a per cent only show up as rounding arguments later.
export const clampPercent = (value, fallback = DEFAULT_OWNER_PERCENT) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
};

// What the settings document says, with the defaults standing in for
// anything missing — including the whole document, the first time.
export const revenueShareSettings = (saved) => ({
  ownerPercent: clampPercent(saved?.revenueShare?.ownerPercent, DEFAULT_OWNER_PERCENT),
});

// The money the split is worked out from.
//
// The pre-discount rental, deliberately. A promo is admin's marketing
// decision, made on a vehicle admin does not own, so admin absorbs the cost
// of it and the consignor is paid on the full price — otherwise a promotion
// they never agreed to would quietly come out of their pocket. This was
// already the rule for what the owner was credited; the split is now taken
// from it rather than it being the whole answer.
//
// subtotal is 0 on bookings made before promos existed — a schema default
// never written to those documents — so fall back to totalPrice, where the
// two were the same number anyway.
export const rentalCreditedFor = (booking) => booking?.subtotal || booking?.totalPrice || 0;

// Was a split agreed on this booking at all?
export const hasAgreedShare = (booking) => Number.isFinite(booking?.ownerShare?.percent);

// 100 when nothing was recorded — see the header. This is a real answer
// about an old booking, not a missing one.
export const agreedPercent = (booking) => (hasAgreedShare(booking) ? booking.ownerShare.percent : 100);

// One rental, two people.
//
// The owner's side is rounded and the business takes whatever is left,
// rather than both being rounded independently. Two roundings of one amount
// can add up to a peso more or less than was actually collected, and these
// two numbers are paid to two different people out of a single sum that
// really came in — so they have to reconcile exactly, every time.
export const splitFor = (booking) => {
  const base = rentalCreditedFor(booking);
  const percent = agreedPercent(booking);
  const owner = Math.round(base * (percent / 100));
  return {
    base,
    percent,
    owner,
    operator: base - owner,
    agreed: hasAgreedShare(booking),
  };
};

// What we are actually left holding on a discounted rental.
//
// splitFor's `operator` is our share of the UNDISCOUNTED rental — what the
// agreement entitles us to. This is what remains of the money that really
// came in once the owner has been paid out of it. The two differ by exactly
// the discount, because we absorb discounts rather than passing them on: a
// promotion is our decision, made on somebody else's vehicle, so it is not
// theirs to fund.
//
// It can come out negative, and that is the point of having it. Our own
// share is the whole of the margin, so a discount bigger than that share
// pays the owner more than the renter handed over.
export const afterDiscount = ({ rental, discount = 0, percent = DEFAULT_OWNER_PERCENT }) => {
  const base = Math.max(0, Number(rental) || 0);
  const off = Math.min(base, Math.max(0, Number(discount) || 0));
  const owner = Math.round(base * (clampPercent(percent) / 100));
  const collected = base - off;
  return { base, discount: off, owner, collected, weKeep: collected - owner };
};

// The deepest a promo can cut, as money off one day's hire.
//
// The shortest rental is the worst case for a fixed amount: ₱500 off is a
// third of a one-day hire at ₱1,500 and a ninth of a three-day one. A
// percentage cuts the same fraction whatever the length, so one day stands
// in for every length there.
export const worstCaseDiscount = (promo, pricePerDay) => {
  const day = Math.max(0, Number(pricePerDay) || 0);
  const value = Math.max(0, Number(promo?.value) || 0);
  if (promo?.type === 'percent') return Math.round((day * Math.min(100, value)) / 100);
  return Math.min(day, value);
};

// Totals across many bookings, summed per booking rather than by applying
// one percentage to a grand total. Bookings can carry different agreed
// rates — an old one at 100%, a new one at 80% — and a single multiplication
// over the lot would be wrong the moment the rate was ever changed.
export const sumSplit = (bookings = []) => bookings.reduce((acc, b) => {
  const { base, owner, operator } = splitFor(b);
  return {
    base: acc.base + base,
    owner: acc.owner + owner,
    operator: acc.operator + operator,
    count: acc.count + 1,
  };
}, { base: 0, owner: 0, operator: 0, count: 0 });
