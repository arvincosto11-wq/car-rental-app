// Long-rental discount rules — the pure logic, shared by server and client.
//
// This file has no imports so the client keeps an identical copy
// (client/src/utils/longRental.js): the price a customer is shown and the
// price the server charges come from the very same functions.

const idOf = (x) => String(x?._id ?? x);

export const ruleAppliesToCar = (rule, carId) =>
  rule.active !== false &&
  (rule.appliesTo === 'all' || (rule.cars || []).some((c) => idOf(c) === idOf(carId)));

// Rules that can ever apply to this vehicle, shortest trip first.
export const rulesForCar = (rules, carId) =>
  (rules || []).filter((r) => ruleAppliesToCar(r, carId)).sort((a, b) => a.minDays - b.minDays);

// The single best rule a trip of this length qualifies for. Rules never
// stack with each other — a 30-day trip that meets both "7+ days: 10%" and
// "30+ days: 20%" gets 20%, not 30%.
export const bestLongRentalRule = (rules, carId, totalDays) =>
  rulesForCar(rules, carId)
    .filter((r) => totalDays >= r.minDays)
    .reduce((best, r) => (!best || r.percent > best.percent ? r : best), null);

export const longRentalLabel = (rule) => `Long-rental discount (${rule.minDays}+ days)`;

export const longRentalDiscountOn = (rule, subtotal) =>
  rule ? Math.min(Math.round(subtotal * (rule.percent / 100)), subtotal) : 0;

// Where a longer trip would cost LESS than one day shorter. Because the
// discounts are percentages this doesn't depend on any car's price: at N
// days the cost is N × (1 − best%), so e.g. 20% off at 7 days (7 × 0.8 =
// 5.6 days' worth) undercuts 6 undiscounted days. Checked across every
// active rule regardless of which vehicles each covers — deliberately
// cautious, since it's a warning rather than a block.
export const findInversions = (rules) => {
  const active = (rules || []).filter((r) => r.active !== false);
  const bestAt = (days) => active
    .filter((r) => days >= r.minDays)
    .reduce((m, r) => Math.max(m, r.percent), 0);
  const cost = (days) => days * (1 - bestAt(days) / 100);
  return [...new Set(active.map((r) => r.minDays))]
    .filter((n) => n > 1 && cost(n) < cost(n - 1) - 1e-9)
    .sort((a, b) => a - b)
    .map((n) => ({ days: n, percent: bestAt(n), previousPercent: bestAt(n - 1) }));
};

// Returns an error message, or null when the rule is fine to save.
export const validateLongRentalRule = ({ minDays, percent, appliesTo, cars }) => {
  const days = Number(minDays);
  const pct = Number(percent);
  if (!Number.isInteger(days) || days < 2 || days > 365) return 'Minimum days must be a whole number from 2 to 365.';
  if (!Number.isFinite(pct) || pct < 1 || pct > 50) return 'The discount must be between 1% and 50%.';
  if (!['all', 'selected'].includes(appliesTo)) return 'Choose all vehicles or selected vehicles.';
  if (appliesTo === 'selected' && !(cars || []).length) return 'Tick at least one vehicle, or choose all vehicles.';
  return null;
};

// Two active rules on the same vehicle clash in either of two ways:
//
//  'same-length' — both start at the same trip length, so the customer
//                  would be offered two "7+ days" deals on one car.
//  'no-gain'     — they start at different lengths, but the longer one
//                  doesn't give MORE off. Since the best qualifying rule
//                  wins, the longer one then never applies: 8+ days at 10%
//                  under an existing 7+ days at 10% changes no price at all.
//
// Tiers that step up (7+ days 10%, 30+ days 12%) are fine.
const sharedVehicles = (a, b) => {
  if (a.appliesTo === 'all' && b.appliesTo === 'all') return 'all';
  if (a.appliesTo === 'all') return (b.cars || []).map(idOf);
  if (b.appliesTo === 'all') return (a.cars || []).map(idOf);
  const inB = new Set((b.cars || []).map(idOf));
  return (a.cars || []).map(idOf).filter((id) => inB.has(id));
};

const clashKind = (a, b) => {
  const da = Number(a.minDays);
  const db = Number(b.minDays);
  if (da === db) return 'same-length';
  const [shorter, longer] = da < db ? [a, b] : [b, a];
  return Number(longer.percent) > Number(shorter.percent) ? null : 'no-gain';
};

// Existing ACTIVE rules that `rule` would clash with, same-length clashes
// first. `ignoreId` is the rule being edited, so it isn't compared with
// itself. Paused rules don't count; resuming one runs this same check.
export const findRuleConflicts = (rule, rules, ignoreId) =>
  (rules || [])
    .filter((r) => r.active !== false && String(r._id) !== String(ignoreId ?? ''))
    .map((r) => ({ rule: r, kind: clashKind(rule, r), shared: sharedVehicles(rule, r) }))
    .filter(({ kind, shared }) => kind && (shared === 'all' || shared.length > 0))
    .sort((x, y) => (x.kind === 'same-length' ? -1 : 0) - (y.kind === 'same-length' ? -1 : 0));

const whoFor = ({ rule, shared }, nameOf) => {
  if (shared === 'all' || rule.appliesTo === 'all') return { who: 'All vehicles', many: true };
  const names = shared.map(nameOf);
  const listed = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
  return { who: listed, many: names.length > 1 };
};

// One sentence explaining the first clash for a rule about to be saved,
// naming the vehicles involved. nameOf turns a car id into "BMW X5".
export const conflictMessage = (conflicts, nameOf, newRule) => {
  const c = conflicts[0];
  const { who, many } = whoFor(c, nameOf);
  const has = many ? 'have' : 'has';
  const other = c.rule;
  if (c.kind === 'same-length' || !newRule) {
    return `${who} already ${has} a ${other.minDays}+ day discount (${other.percent}% off). `
      + 'Edit that discount instead, or choose a different number of days.';
  }
  if (Number(newRule.minDays) > Number(other.minDays)) {
    return `${who} already ${has} ${other.percent}% off from ${other.minDays}+ days, so ${newRule.minDays}+ days `
      + `at ${newRule.percent}% would never apply. A longer trip needs a bigger discount — more than ${other.percent}%.`;
  }
  return `${who} ${has} ${other.percent}% off from ${other.minDays}+ days. ${newRule.minDays}+ days at `
    + `${newRule.percent}% would override it, so that longer discount would never apply. `
    + `Keep this one below ${other.percent}%, or change the other one.`;
};

// Short note for a rule that is already saved and clashes — e.g. one saved
// before these checks existed.
export const existingClashNote = (conflicts) => {
  const c = conflicts[0];
  return c.kind === 'same-length'
    ? `Clashes with another ${c.rule.minDays}+ day discount on the same vehicle. Delete or edit one of them.`
    : `Overlaps the ${c.rule.minDays}+ day discount (${c.rule.percent}% off) on the same vehicle, so one of them never applies. Delete or edit one.`;
};
