// When a booking was accepted, and when it died.
//
// Kept as a plain function so it can be tested without a database: the
// model's save hook only decides WHEN to ask, and this decides what the
// answer is.
//
// The rules, both learned from how bookings actually move:
//   · The first acceptance is the one that counts. A booking confirmed in
//     September, cancelled, then reinstated in October was still won in
//     September, and overwriting that would quietly rewrite history.
//   · A booking that comes back to life drops its cancelled date, so
//     nothing live carries a date saying it is dead.
export function statusTimes(status, { confirmedAt = null, cancelledAt = null } = {}, now = new Date()) {
  return {
    confirmedAt: status === 'confirmed' && !confirmedAt ? now : confirmedAt,
    cancelledAt: status === 'cancelled' ? now : null,
  };
}
