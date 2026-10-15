// How late a vehicle came back, in words.
//
// The fine is one day's rental per day late, so anybody even an hour over
// is charged a full day. Saying "1 day late" for an hour would overstate
// what happened; saying "5 h late" for three days would understate it.
//
// So: under a day, say the hours, which is the honest measure of a late
// afternoon. A day or more, say whole days — the same number the fee was
// charged on, so the history and the money never disagree.

const HOUR = 60 * 60 * 1000;

export const hoursLate = (dueAt, returnedAt) => {
  if (!dueAt || !returnedAt) return 0;
  const over = new Date(returnedAt).getTime() - new Date(dueAt).getTime();
  return over <= 0 ? 0 : over / HOUR;
};

// `chargedDays` is what the booking's own late fee was worked out on, kept
// rather than recomputed so one number tells both stories.
export function latenessLabel(hours, chargedDays = 0) {
  if (hours <= 0) return '';
  if (hours < 1) return 'Returned under an hour late';
  if (hours < 24) {
    const h = Math.round(hours);
    return `Returned ${h} h late`;
  }
  const days = chargedDays || Math.floor(hours / 24);
  return `Returned ${days} day${days === 1 ? '' : 's'} late`;
}
