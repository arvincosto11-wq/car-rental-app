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

// The same measure for a vehicle that has not come back yet. "1 day
// overdue" for a vehicle three hours past its time reads as a lost day
// and sends somebody chasing a client who is on their way.
//
// The fee is still charged by the day — three hours over is a day's
// rental — but how late somebody IS and what they OWE are two different
// sentences, and only the second one is about days.
export function overdueLabel(hours, chargedDays = 0) {
  if (hours <= 0) return '';
  if (hours < 1) return 'Under an hour overdue';
  if (hours < 24) return `${Math.round(hours)} h overdue`;
  const days = chargedDays || Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} overdue`;
}

// Short form for a chip beside a row: "5 h late", "2 days late".
export function lateChip(hours, chargedDays = 0) {
  if (hours <= 0) return '';
  if (hours < 1) return 'under an hour late';
  if (hours < 24) return `${Math.round(hours)} h late`;
  const days = chargedDays || Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} late`;
}
