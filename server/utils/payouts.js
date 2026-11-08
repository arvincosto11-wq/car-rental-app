// Paying a vehicle's owner what they have earned.
//
// The system does not move the money. There is no way for it to: sending
// pesos to somebody else's GCash needs a licensed disbursement facility the
// business would have to be approved for, and a refund — the one payment we
// do send automatically — only works because it travels back down a payment
// somebody already made to us. A consignor never paid us anything, so there
// is nothing to reverse.
//
// So this is a ledger, not a payment rail. Admin sends the money in their
// own GCash app and then writes down what they sent. Four things make a
// written-down payment hold up:
//
//   the GCash reference number, which both sides can look up afterwards;
//   the receipt screenshot, kept privately like every other document here;
//   the owner seeing it the moment it is recorded, and confirming receipt;
//   and a void that leaves a reason behind rather than deleting the row.
//
// WHAT IS PAYABLE. A finished trip, and nothing else. A booking is earned
// the moment it is confirmed — that is what the income figures count, and
// what the owner's dashboard has always shown — but it is not payable until
// the vehicle is back, because a confirmed booking can still be cancelled
// and refunded. Paying on a confirmation means handing over a share of
// money we may yet give back. So "earned" and "owed" are different
// questions on purpose, and the pages say both.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/payouts.js). The admin page, the owner's dashboard and
// the server all have to reach the same peso.

// How the money actually travelled. GCash is the normal one; cash is for
// an owner paid at the counter, which happens and must not go unrecorded;
// a bank transfer is rarer but real.
export const PAYOUT_METHODS = ['gcash', 'cash', 'bank'];

export const methodLabel = (method) => (
  method === 'gcash' ? 'GCash'
    : method === 'cash' ? 'Cash'
      : method === 'bank' ? 'Bank transfer'
        : 'Unknown'
);

// Only a GCash transfer is refused without one. Every GCash send produces a
// reference, it costs nothing to copy across, and it is the single piece of
// evidence that settles an argument months later. A bank transfer has one
// too but it is not always to hand, and cash has none by definition.
export const referenceRequired = (method) => method === 'gcash';

export const cleanReference = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

// Trips whose money has genuinely been collected and whose vehicle is back.
export const isPayable = (booking) => booking?.status === 'completed';

// A trip that will be payable, but is not yet.
export const isComing = (booking) => booking?.status === 'confirmed';

// When the trip actually ended. returnedAt is written when the vehicle is
// handed back; endDate stands in for the handful of bookings completed
// before that field existed.
export const finishedAt = (booking) => {
  const when = booking?.returnedAt || booking?.endDate;
  return when ? new Date(when) : null;
};

// How long an owner has been waiting on their oldest unpaid trip. Whole
// days, because "waiting since 30 October" is the useful form and hours
// would be false precision on something settled weekly or monthly.
export const daysWaiting = (since, now = new Date()) => {
  if (!since) return 0;
  const from = new Date(since);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, Math.floor((now - from) / 86400000));
};

// Past this, the row says so in gold on the admin page. Two weeks is not a
// rule anybody agreed with an owner — no payment schedule exists — it is
// just long enough that a quiet consignor has probably been forgotten
// rather than deliberately left.
export const WAITING_WARN_DAYS = 14;

// Everything the money columns are worked out from, in one pass.
//
// `share` is the owner's side of one booking, passed in rather than
// computed here, so this file never has to know how the split works and
// revenueShare.js stays the only place that does.
//
// `paidIds` is the set of booking ids already covered by a payout that has
// not been voided. Membership of a live payout is what "paid" means — there
// is no paid flag on the booking itself, deliberately, because two records
// of one fact drift apart and the one that drifts here is money.
export const owedSummary = ({ bookings = [], share, paidIds = new Set() }) => {
  let owed = 0;
  let coming = 0;
  let oldestUnpaidAt = null;
  const payable = [];

  for (const booking of bookings) {
    if (isComing(booking)) {
      coming += share(booking);
      continue;
    }
    if (!isPayable(booking)) continue;
    if (paidIds.has(String(booking._id ?? booking.id))) continue;

    const amount = share(booking);
    const ended = finishedAt(booking);
    owed += amount;
    payable.push({ booking, amount, endedAt: ended });
    if (ended && (!oldestUnpaidAt || ended < oldestUnpaidAt)) oldestUnpaidAt = ended;
  }

  payable.sort((a, b) => {
    if (!a.endedAt) return 1;
    if (!b.endedAt) return -1;
    return a.endedAt - b.endedAt;
  });

  return { owed, coming, oldestUnpaidAt, payable };
};

// What a payout is allowed to be, checked the same way on both sides so the
// dialog refuses before the server has to.
//
// The amount is NOT taken from this check. It is added up on the server
// from the trips being settled, because an amount posted by a browser is a
// claim about money and the trips are the record of it.
export const payoutProblem = ({ method, reference, bookingIds = [] } = {}) => {
  if (!PAYOUT_METHODS.includes(method)) {
    return 'Say how the money was sent.';
  }
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return 'Choose at least one trip this payment settles.';
  }
  if (referenceRequired(method) && !cleanReference(reference)) {
    return 'Enter the GCash reference number — it is the proof the money moved.';
  }
  return '';
};

// A void has to say why. A payment that simply disappears is worse than the
// mistake that caused it: the owner saw the first figure, and an amount
// that vanishes without a reason is indistinguishable from one being hidden.
export const voidProblem = (reason) => (
  String(reason ?? '').trim().length < 4
    ? 'Say why this payment is being voided. The owner sees the reason too.'
    : ''
);

// A payout still standing, as opposed to one that has been voided. Voided
// payouts are never deleted, so every total has to filter rather than
// assume.
export const isLive = (payout) => payout?.status !== 'void';
