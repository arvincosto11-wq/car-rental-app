import { dayAlignedSpan, addDays } from './phTime';

// A blocked range whose end date has passed can't affect anything — the
// booking form only accepts future dates, so findBlockedRange on the server
// will never match it again. It's dead weight in the list, and the list
// otherwise grows for the life of the vehicle.
//
// These are hidden rather than deleted: a range records WHY a vehicle was
// off the road, which is worth being able to look back at. Both screens
// offer a toggle to show them again.

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const isPastBlock = (block, today = startOfToday()) =>
  new Date(block.endDate).setHours(0, 0, 0, 0) < today;

// Splits rather than filters, so callers can say how many are hidden.
export const splitBlockedDates = (blocks = []) => {
  const today = startOfToday();
  const current = [];
  const past = [];
  for (const b of blocks) (isPastBlock(b, today) ? past : current).push(b);
  return { current, past };
};

// Copied verbatim from server/utils/availability.js, which is the authority
// on what a range actually covers. A block runs midnight to midnight in
// Legazpi unless admin gave it hours, and `endsInclusive` says whether
// endDate is the last day off the road or the day the vehicle is back.
//
// Duplicated rather than approximated: the two have disagreed before, and a
// rule about which days a vehicle is out of service is not one to guess at.
export const blockedSpan = (block) => {
  if (block.hasTime) return { start: new Date(block.startDate), end: new Date(block.endDate) };
  const span = dayAlignedSpan(block.startDate, block.endDate);
  return block.endsInclusive ? { start: span.start, end: addDays(span.end, 1) } : span;
};

export const bookingSpan = (booking) => (booking.hasPickupTime
  ? { start: new Date(booking.startDate), end: new Date(booking.endDate) }
  : dayAlignedSpan(booking.startDate, booking.endDate));

export const overlaps = (a, b) => a.start < b.end && a.end > b.start;

// Whether the vehicle is out of service for the dates this booking needs:
// off the road entirely, or inside an approved block. A block only counts
// once approved — a consignor's request has no effect until admin signs off.
export const vehicleOutOfService = (booking) => {
  const car = booking?.car;
  if (!car) return false;
  if (car.offRoad?.since) return true;
  const span = bookingSpan(booking);
  return (car.blockedDates || []).some((b) => b.status === 'approved' && overlaps(span, blockedSpan(b)));
};
