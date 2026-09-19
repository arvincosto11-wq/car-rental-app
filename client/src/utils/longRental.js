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

// Two active rules clash when they start at the same trip length and cover
// at least one vehicle in common — the customer would be offered two "7+
// days" deals on the same car. Different lengths on the same car are fine:
// that's how tiers work (7+ days and 30+ days).
const sharedVehicles = (a, b) => {
  if (a.appliesTo === 'all' && b.appliesTo === 'all') return 'all';
  if (a.appliesTo === 'all') return (b.cars || []).map(idOf);
  if (b.appliesTo === 'all') return (a.cars || []).map(idOf);
  const inB = new Set((b.cars || []).map(idOf));
  return (a.cars || []).map(idOf).filter((id) => inB.has(id));
};

// Existing ACTIVE rules that `rule` would clash with. `ignoreId` is the rule
// being edited, so it isn't compared with itself. Paused rules don't count;
// resuming one runs this same check.
export const findRuleConflicts = (rule, rules, ignoreId) =>
  (rules || [])
    .filter((r) => r.active !== false
      && String(r._id) !== String(ignoreId ?? '')
      && Number(r.minDays) === Number(rule.minDays))
    .map((r) => ({ rule: r, shared: sharedVehicles(rule, r) }))
    .filter(({ shared }) => shared === 'all' || shared.length > 0);

// One sentence explaining the first clash, naming the vehicles involved.
// nameOf turns a car id into "BMW X5".
export const conflictMessage = (conflicts, nameOf) => {
  const { rule, shared } = conflicts[0];
  let who;
  if (shared === 'all' || rule.appliesTo === 'all') {
    who = 'All vehicles already have';
  } else {
    const names = shared.map(nameOf);
    const listed = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
    who = `${listed} already ${names.length === 1 ? 'has' : 'have'}`;
  }
  return `${who} a ${rule.minDays}+ day discount (${rule.percent}% off). `
    + 'Edit that discount instead, or choose a different number of days.';
};
