// What a client gets back when they cancel.
//
// This used to be tiered on how long ago the booking was MADE: full refund
// within 12 hours of booking, half up to 24, nothing after. It measured how
// quickly somebody changed their mind, which is not what the business loses.
// It failed in both directions, and the second one was worse:
//
//   Booked 8am for a 10am pickup, cancelled 9:55am — a full refund for five
//   minutes' notice, with the day gone and nothing to resell.
//
//   Booked today for a trip in two months, cancelled tomorrow — nothing at
//   all, because it is "more than 24 hours since booking". The client who
//   gave eight weeks' notice got less than the one who gave five minutes.
//
// So it is tiered on NOTICE before pickup instead, which is the thing that
// decides whether the dates can be sold again. Three days is enough to
// resell a weekend; inside a day it is not, which is also why a no-show
// forfeits everything — the two rules now agree rather than contradict.
//
// The mistake window is the one exception: the wrong date, the wrong
// vehicle, the same booking twice. It is deliberately short, and it does
// NOT apply to a booking starting within the next couple of hours — the
// undo would otherwise hand back a full refund for minutes of notice, which
// is the first failure above wearing a different hat.
//
// This file has no imports so the client keeps an identical copy (see
// server/utils/refundPolicy.js). The refund button, the admin cancel
// path and every sentence that quotes the policy have to agree, and two
// descriptions of one rule have drifted in this project before.

// Long enough to undo a mistake, short enough that it is not a free option
// on a booking somebody has had all afternoon to think about.
export const MISTAKE_WINDOW_HOURS = 1;
// ...but only on a booking that is not about to start.
export const MISTAKE_MIN_NOTICE_HOURS = 2;
// Three days: a weekend slot given up this far out can realistically be
// sold again.
export const FULL_REFUND_NOTICE_HOURS = 72;
// Inside a day the vehicle is prepared and the slot is effectively dead.
export const HALF_REFUND_NOTICE_HOURS = 24;

const hoursBetween = (from, to) =>
  (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60);

// percent, plus which rule decided it — the UI quotes a different sentence
// for each, and working it out twice is how the words and the figure drift
// apart.
export function refundOutcome(booking, now = new Date()) {
  if (!booking?.startDate || !booking?.createdAt) {
    return { percent: 0, basis: 'none', noticeHours: 0 };
  }
  const noticeHours = hoursBetween(now, booking.startDate);
  const sinceBooked = hoursBetween(booking.createdAt, now);

  if (sinceBooked <= MISTAKE_WINDOW_HOURS && noticeHours > MISTAKE_MIN_NOTICE_HOURS) {
    return { percent: 100, basis: 'mistake', noticeHours };
  }
  if (noticeHours >= FULL_REFUND_NOTICE_HOURS) {
    return { percent: 100, basis: 'full', noticeHours };
  }
  if (noticeHours >= HALF_REFUND_NOTICE_HOURS) {
    return { percent: 50, basis: 'half', noticeHours };
  }
  return { percent: 0, basis: 'none', noticeHours };
}

export const refundPercentage = (booking, now = new Date()) => refundOutcome(booking, now).percent;

// Which notice band a pickup falls in, for a booking that does not exist yet.
//
// refundOutcome needs a createdAt, and on the confirm screen the only honest
// value for that is "now" — which makes every prospective booking look like
// the mistake window and hides the band that actually applies a minute after
// paying. This answers the narrower question the confirm wording needs:
// given this pickup, what does notice alone decide?
export function noticeBand(pickupAt, now = new Date()) {
  if (!pickupAt) return { band: 'unknown', noticeHours: 0 };
  const noticeHours = hoursBetween(now, pickupAt);
  if (noticeHours >= FULL_REFUND_NOTICE_HOURS) return { band: 'full', noticeHours };
  if (noticeHours >= HALF_REFUND_NOTICE_HOURS) return { band: 'half', noticeHours };
  // Nothing back on notice alone, but the mistake window is still reachable.
  if (noticeHours > MISTAKE_MIN_NOTICE_HOURS) return { band: 'mistakeOnly', noticeHours };
  return { band: 'none', noticeHours };
}
