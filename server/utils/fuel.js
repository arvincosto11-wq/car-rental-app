// Terms and Conditions, section 5: "The vehicle must be returned with the
// same fuel level it had at pickup. If it is returned with less fuel, the
// difference will be charged to the renter."
//
// Two readings and one gap. The readings are easy: note the gauge when the
// keys go over and again when they come back. The gap is that the clause
// names no rate — unlike section 8's late fee, which is one day's hire per
// day — so the system cannot work the money out. Fuel costs what fuel costs
// that week, and only the person who buys it knows. So the shortfall is
// measured here and the cost is entered by whoever refuels, with the
// shortfall shown beside it so the figure can be checked against something.

// Eighths of a tank. Fine enough to match what a gauge actually shows, and
// coarse enough that two people reading the same needle agree.
export const FUEL_STEPS = 8;

const LABELS = ['Empty', '1/8', '1/4', '3/8', 'Half', '5/8', '3/4', '7/8', 'Full'];

export const fuelLabel = (eighths) => {
  const n = Number(eighths);
  return Number.isInteger(n) && n >= 0 && n <= FUEL_STEPS ? LABELS[n] : '—';
};

export const isFuelLevel = (value) => {
  // Checked before Number(), which turns null, undefined and '' into 0 —
  // and 0 is a real reading here, meaning the tank came back empty. Without
  // this, a return nobody read looked like a return on an empty tank, and
  // the client was charged for a whole tank of fuel on no evidence at all.
  if (value === null || value === undefined || value === '') return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= FUEL_STEPS;
};

// How much less came back than went out, in eighths. Zero when it came back
// the same or fuller — nobody is charged for being generous, and nobody is
// charged on a booking where one of the two readings is missing, because a
// missing reading is not evidence of anything.
export const fuelShortfall = (booking) => {
  const out = booking?.fuel?.atPickup;
  const back = booking?.fuel?.atReturn;
  if (!isFuelLevel(out) || !isFuelLevel(back)) return 0;
  return Math.max(0, Number(out) - Number(back));
};

// What to say about it, in the units on the dashboard rather than in eighths.
export const fuelShortfallLabel = (booking) => {
  const missing = fuelShortfall(booking);
  if (!missing) return '';
  if (missing === FUEL_STEPS) return 'a full tank';
  if (missing % 2 === 0) return `${missing / 2}/4 of a tank`.replace('4/4', 'a full tank');
  return `${missing}/8 of a tank`;
};
