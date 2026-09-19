// Promo pricing — the single source of truth for what a booking costs.
//
// Dates are normalised to UTC day boundaries, matching the rest of the
// server (see autoCompleteExpiredBookings in routes/bookings.js). Booking
// dates arrive as YYYY-MM-DD and parse to UTC midnight, so this lines up
// without a second timezone convention to keep straight.

const MAX_PERCENT = 50;

const startOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const endOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

// A promo exists only once it has both dates — the schema defaults leave
// them undefined, which is how every vehicle starts out.
export const hasPromo = (promo) => !!(promo && promo.startDate && promo.endDate && promo.value > 0);

// Whether a rental qualifies. The WHOLE rental has to sit inside the window:
// starting inside it but returning after it ends does not qualify, which is
// what stops a six-day promo discounting a month-long rental.
export const promoCoversRange = (promo, start, end) => {
  if (!hasPromo(promo)) return false;
  return start >= startOfDayUTC(promo.startDate) && end <= endOfDayUTC(promo.endDate);
};

// Has the promo's window already passed? Used to stop showing a dead badge.
export const promoHasEnded = (promo, now = new Date()) =>
  hasPromo(promo) && now > endOfDayUTC(promo.endDate);

// The one price calculation. Returns the pre-discount subtotal, what came
// off, and what's actually owed — all three get stored on the booking so the
// receipt stays readable after the promo is edited or cleared.
export const computeBookingPrice = (car, totalDays, start, end) => {
  const subtotal = totalDays * car.pricePerDay;
  const promo = car.promo;

  if (!promoCoversRange(promo, start, end)) {
    return { subtotal, discountAmount: 0, totalPrice: subtotal, promoLabel: '' };
  }

  const raw = promo.type === 'amount'
    ? promo.value
    : Math.round(subtotal * (promo.value / 100));

  // Never below zero, however the promo was configured. validatePromo keeps
  // a fixed amount under one day's rate so this can't normally bite, but a
  // price cut after the promo was set could still get here.
  const discountAmount = Math.min(Math.max(raw, 0), subtotal);

  return {
    subtotal,
    discountAmount,
    totalPrice: subtotal - discountAmount,
    promoLabel: promo.label || '',
  };
};

// Returns an error message, or null when the promo is fine to save.
export const validatePromo = ({ label, type, value, startDate, endDate }, car) => {
  if (!label || !label.trim()) return 'Please give the promo a name customers will see.';
  if (!['percent', 'amount'].includes(type)) return 'Choose a percentage or a fixed amount.';

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a discount greater than zero.';

  if (type === 'percent' && amount > MAX_PERCENT) {
    return `A percentage discount can't be more than ${MAX_PERCENT}%.`;
  }
  // One day is the shortest possible rental, so keeping a fixed amount below
  // the daily rate guarantees no booking can ever reach zero or go negative.
  if (type === 'amount' && amount >= car.pricePerDay) {
    return `A fixed discount has to be less than one day's rate (₱${car.pricePerDay.toLocaleString()}).`;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!startDate || !endDate || isNaN(start) || isNaN(end)) return 'Please pick both promo dates.';
  if (endOfDayUTC(end) < startOfDayUTC(start)) return 'The promo cannot end before it starts.';

  return null;
};
