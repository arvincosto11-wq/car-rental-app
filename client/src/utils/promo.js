// Client-side mirror of server/utils/promo.js. The server is always the
// authority on what a booking costs — this exists so the price preview and
// the badges can say the same thing before anyone commits to a booking.
//
// Promo dates are stored as UTC midnight, so they're read back with UTC
// getters. Using local ones would shift them a day in PH and a promo ending
// "Sept 25" would appear to end on the 24th.

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

export const hasPromo = (promo) => !!(promo && promo.startDate && promo.endDate && promo.value > 0);

// Shown from the moment admin sets it, including before it starts — seeing
// the dates in advance is what makes someone move their trip onto them.
export const isPromoVisible = (promo, now = new Date()) =>
  hasPromo(promo) && now <= endOfDayUTC(promo.endDate);

export const isPromoRunning = (promo, now = new Date()) =>
  hasPromo(promo) && now >= startOfDayUTC(promo.startDate) && now <= endOfDayUTC(promo.endDate);

// Both sides are really calendar DATES, so they're compared as calendar
// dates. ISO day strings sort correctly as plain text, so >= and <= do the
// right thing — and the two are anchored differently, so each is read its
// own way: a promo date sits at UTC midnight and means a plain day, while a
// rental is a real moment in Legazpi, where 7:00 AM is 11:00 PM the day
// BEFORE in UTC. Comparing the raw instants threw a client off the first day
// of every promo they booked on. Same rule as the server.
const promoDay = (d) => new Date(d).toISOString().slice(0, 10);
const rentalDay = (d) => new Date(new Date(d).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

// The whole rental has to sit inside the window — same rule as the server.
export const promoCoversRange = (promo, start, end) => {
  if (!hasPromo(promo) || !start || !end) return false;
  return rentalDay(start) >= promoDay(promo.startDate) && rentalDay(end) <= promoDay(promo.endDate);
};

export const promoOffer = (promo) => {
  if (!hasPromo(promo)) return '';
  return promo.type === 'amount'
    ? `₱${Number(promo.value).toLocaleString()} off`
    : `${promo.value}% off`;
};

// "Sep 20–25" when it's one month, "Sep 28 – Oct 2" when it spans two.
export const promoDateRange = (promo) => {
  if (!hasPromo(promo)) return '';
  const s = new Date(promo.startDate);
  const e = new Date(promo.endDate);
  const month = (d) => d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = (d) => d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
  return month(s) === month(e)
    ? `${month(s)} ${day(s)}\u2013${day(e)}`
    : `${month(s)} ${day(s)} \u2013 ${month(e)} ${day(e)}`;
};

// What a promo takes off a given subtotal. Mirrors computeBookingPrice.
export const promoDiscountOn = (promo, subtotal) => {
  if (!hasPromo(promo)) return 0;
  const raw = promo.type === 'amount' ? promo.value : Math.round(subtotal * (promo.value / 100));
  return Math.min(Math.max(raw, 0), subtotal);
};

// What a vehicle's owner is credited for a booking.
//
// A promo is admin's marketing decision, made on a vehicle admin doesn't
// own, so admin absorbs the cost of it — the consignor is paid on the
// pre-discount price. Paying them the discounted total would quietly take
// money out of someone else's pocket to fund a promotion they never agreed
// to, and they'd have no way to see why their earnings dropped.
//
// subtotal is 0 on bookings made before promos existed — a schema default
// that was never written to those documents — so fall back to totalPrice
// for those, where the two were the same number anyway.
export const ownerEarningFor = (booking) => booking.subtotal || booking.totalPrice;

// What admin absorbed on this booking, if anything.
export const adminCoveredFor = (booking) => booking.discountAmount || 0;
