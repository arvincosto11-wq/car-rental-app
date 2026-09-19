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
