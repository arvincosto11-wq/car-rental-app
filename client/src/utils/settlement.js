// What a client can still pay online, and what that payment settles.
//
// Every other GCash payment in this system is tied to one thing the
// client is agreeing to: these dates, these extra days, this vehicle. The
// amount is worked out by the server for that decision and the button
// sits inside the panel where the decision is made.
//
// This one follows the same shape for the money a booking has simply left
// outstanding — the balance after a deposit, and the charges a trip ended
// with. It is the server's figure, never the page's: a client who could
// name their own amount would pay ₱1 against a ₱6,000 late fee.
//
// Damage is deliberately not here. It is settled at the counter, with the
// vehicle in front of both parties, because it is the one charge that
// gets argued about and the one nobody should be able to close from a
// phone before anybody has looked at the car.

export const SETTLES = ['balance', 'lateFee', 'fuel'];

export function payableNow(booking) {
  const none = { amount: 0, balance: 0, lateFee: 0, fuel: 0 };
  if (!booking) return none;
  // A checkout nobody finished is its own flow — the client resumes the
  // original payment rather than settling anything.
  if (booking.payment !== 'paid') return none;
  // Nothing is collected on a booking that is not happening.
  if (booking.status === 'cancelled' || booking.status === 'pending') return none;

  const balance = Math.max(0, (booking.totalPrice || 0) - (booking.amountPaid || 0));
  const lateFee = !booking.lateFee?.collectedAt ? (booking.lateFee?.amount || 0) : 0;
  const fuel = !booking.fuel?.collectedAt ? (booking.fuel?.charge || 0) : 0;

  return { amount: balance + lateFee + fuel, balance, lateFee, fuel };
}

// What the money that just arrived should close, worked out again at the
// moment it lands rather than trusted from when the checkout opened. The
// counter can collect the same balance while a client stands at GCash,
// and the booking that comes back may owe less than the one that left.
export function applyPayment(booking, amount, at = new Date()) {
  let left = Math.round(amount || 0);
  const settled = [];
  const due = payableNow(booking);

  if (left > 0 && due.balance > 0) {
    const take = Math.min(left, due.balance);
    booking.amountPaid = (booking.amountPaid || 0) + take;
    left -= take;
    settled.push('balance');
  }
  // A charge is a stamp, not a running total: there is nowhere to record
  // half a late fee, so one only closes if the money covers it whole. The
  // order is fixed and it stops at the first charge it cannot cover —
  // skipping ahead to a cheaper one would leave the dearer charge open
  // with the remainder reported as an overpayment, which is nonsense.
  for (const [kind, owed, stamp] of [
    ['lateFee', due.lateFee, (when) => { booking.lateFee.collectedAt = when; }],
    ['fuel', due.fuel, (when) => { booking.fuel.collectedAt = when; }],
  ]) {
    if (owed <= 0) continue;
    if (left < owed) break;
    stamp(at);
    left -= owed;
    settled.push(kind);
  }

  // Whatever is left over had nothing to close — the counter got there
  // first while the client was paying. The money is real and already on
  // the booking, so it is reported rather than quietly kept.
  return { settled, overpaid: Math.max(0, left) };
}
