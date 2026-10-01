import { suite, group, check } from './harness.mjs';
import { refundPercentage, refundAmountFor, isUnderway, reasonUnavailable, CANCEL_REASONS, unusedDayRefund } from '../utils/cancelBooking.js';
import { paymentSources } from '../utils/paymongo.js';
import { instantFrom } from '../utils/phTime.js';
import { noticeBand, refundOutcome } from '../utils/refundPolicy.js';

const hoursAgo = (n, now) => new Date(now.getTime() - n * 60 * 60 * 1000);
const hoursAhead = (n, now) => new Date(now.getTime() + n * 60 * 60 * 1000);
const now = new Date('2026-09-22T12:00:00+08:00');

// Ten days out by default, so a fixture that says nothing about its pickup
// is comfortably inside the full-refund tier and the groups below are only
// testing the thing they name.
const paid = (over = {}) => ({
  payment: 'paid',
  amountPaid: 2000,
  createdAt: hoursAgo(1, now),
  startDate: hoursAhead(24 * 10, now),
  ...over,
});

// A booking made long enough ago that the mistake window has closed, so the
// tiers are what is being measured.
const settled = (noticeHours) => ({
  createdAt: hoursAgo(48, now),
  startDate: hoursAhead(noticeHours, now),
});

export default function run() {
  suite('Refunds');

  group('the tiers, measured by notice before pickup');
  check('a week out', refundPercentage(settled(24 * 7), now), 100);
  check('exactly three days', refundPercentage(settled(72), now), 100);
  check('an hour inside three days', refundPercentage(settled(71), now), 50);
  check('two days', refundPercentage(settled(48), now), 50);
  check('exactly one day', refundPercentage(settled(24), now), 50);
  check('an hour inside one day', refundPercentage(settled(23), now), 0);
  check('an hour before pickup', refundPercentage(settled(1), now), 0);
  check('pickup already passed', refundPercentage(settled(-2), now), 0);

  group('what the old rule got backwards');
  // It tiered on how long ago the booking was MADE, so these two came out
  // the wrong way round: eight weeks' notice returned nothing because the
  // booking was old, and five minutes' notice returned everything because
  // it was fresh.
  check('booked a month ago, cancelled eight weeks before the trip',
    refundPercentage({ createdAt: hoursAgo(24 * 30, now), startDate: hoursAhead(24 * 56, now) }, now), 100);
  check('booked this morning, cancelled five minutes before pickup',
    refundPercentage({ createdAt: hoursAgo(4, now), startDate: hoursAhead(1 / 12, now) }, now), 0);

  group('the mistake window: the wrong date, the wrong vehicle, booked twice');
  const fresh = (sinceBooked, noticeHours) => ({
    createdAt: hoursAgo(sinceBooked, now),
    startDate: hoursAhead(noticeHours, now),
  });
  check('undone half an hour later', refundPercentage(fresh(0.5, 5), now), 100);
  check('at exactly an hour', refundPercentage(fresh(1, 5), now), 100);
  // Past the window, five hours' notice is just five hours' notice.
  check('an hour and a half later', refundPercentage(fresh(1.5, 5), now), 0);
  // The undo must not become the old hole wearing a different hat: a full
  // refund for minutes of notice on a booking that starts almost at once.
  check('not on a booking starting within two hours', refundPercentage(fresh(0.1, 1.5), now), 0);
  check('but yes at just over two hours', refundPercentage(fresh(0.1, 2.5), now), 100);
  // And it never has to: a fresh booking far out already qualifies.
  check('a fresh booking far out needs no window', refundPercentage(fresh(0.1, 24 * 9), now), 100);

  group('why it was cancelled decides what comes back');
  // The business pulled the vehicle, so the tiers — which exist to price a
  // client changing their mind — have nothing to say about it.
  check('vehicle unavailable, fresh booking', refundAmountFor(paid(), 'vehicle_unavailable', now), 2000);
  check('vehicle unavailable, week-old booking', refundAmountFor(paid({ createdAt: hoursAgo(24 * 7, now) }), 'vehicle_unavailable', now), 2000);

  group('a client changing their mind gets the normal policy');
  // Deliberately the same tiers as the in-app refund button, so nobody past
  // the window can get a full refund just by messaging admin instead.
  check('plenty of notice', refundAmountFor(paid(), 'client_requested', now), 2000);
  check('two days out', refundAmountFor(paid({ ...settled(48) }), 'client_requested', now), 1000);
  check('on the day', refundAmountFor(paid({ ...settled(6) }), 'client_requested', now), 0);

  group('terms not met: half back, or nothing once the day arrives');
  // The deduction is the day itself. Before it, the vehicle can still be let
  // to somebody else and half is kept; on it, the day is gone whether this
  // happens at 7:00 AM or at the counter, so nothing comes back.
  const from = (ymd) => paid({ startDate: instantFrom(ymd, 7), endDate: instantFrom(ymd, 7), hasPickupTime: true });
  check('cancelled the day before', refundAmountFor(from('2026-09-23'), 'terms_not_met', now), 1000);
  check('cancelled weeks ahead', refundAmountFor(from('2026-10-15'), 'terms_not_met', now), 1000);
  check('turned away on the day', refundAmountFor(from('2026-09-22'), 'terms_not_met', now), 0);
  // Measured in Philippine time, not UTC. 7:00 AM here is 11:00 PM the
  // previous day in UTC, so a UTC comparison would call this "the day
  // before" and hand back half of a day that has already started.
  check('at 7:00 AM on the pickup day', refundAmountFor(from('2026-09-22'), 'terms_not_met', new Date('2026-09-22T07:00:00+08:00')), 0);
  check('rounds to the peso', refundAmountFor({ ...from('2026-10-15'), amountPaid: 1575 }, 'terms_not_met', now), 788);

  group('a client who drove away has met the terms');
  // Admin can now cancel a booking after accepting it, which is what makes
  // this reachable at all — and mid-trip, "terms not met" is the one reason
  // that cannot be true, since producing the documents is how they got the
  // keys. It keeps back half their money, so it is refused outright rather
  // than merely hidden in the dialog.
  const out = { collectedAt: new Date('2026-09-22T08:15:00+08:00') };
  check('refused once the vehicle is out', !!reasonUnavailable(out, 'terms_not_met'), true);
  check('allowed while it is still here', reasonUnavailable({ collectedAt: null }, 'terms_not_met'), null);
  check('our own fault stays available mid-trip', reasonUnavailable(out, 'vehicle_unavailable'), null);
  check('so does the client asking', reasonUnavailable(out, 'client_requested'), null);
  // Nothing is quietly ruled out as reasons get added. The breakdown pair
  // are the deliberate exception in the other direction: they need somebody
  // to have the vehicle, because nothing breaks down mid-trip on a trip
  // that has not started.
  // The reasons that need somebody to have the vehicle: a breakdown
  // mid-trip, and a vehicle that never came back.
  const needsCollection = (r) => r.startsWith('breakdown') || r === 'not_returned';
  const beforePickup = CANCEL_REASONS.filter((r) => !needsCollection(r));
  check('every other reason works before pickup',
    beforePickup.every((r) => reasonUnavailable({ collectedAt: null }, r) === null), true);
  check('and every reason works once collected',
    CANCEL_REASONS.filter((r) => r !== 'terms_not_met')
      .every((r) => reasonUnavailable({ collectedAt: new Date() }, r) === null), true);

  group("a reason nothing offers any more can't quietly pay out");
  // 'other' let admin type any figure. It is gone from the dialog and from
  // CANCEL_REASONS; if anything ever sends it again it refunds nothing
  // rather than falling through to an unchecked amount.
  check('the retired free-amount reason', refundAmountFor(paid(), 'other', now), 0);
  check('a reason nobody recognises', refundAmountFor(paid(), 'whatever', now), 0);

  group('nothing comes back from a booking that never paid');
  check('never paid', refundAmountFor(paid({ payment: 'offline' }), 'vehicle_unavailable', now), 0);
  check('abandoned at GCash', refundAmountFor(paid({ payment: 'gcash_pending' }), 'vehicle_unavailable', now), 0);
  check('paid nothing', refundAmountFor(paid({ amountPaid: 0 }), 'vehicle_unavailable', now), 0);

  group('a booking already underway is left alone');
  // The client physically has the vehicle, so the blocked-dates sweep
  // reports it rather than cancelling behind their back.
  const running = { startDate: instantFrom('2026-09-21', 7), endDate: instantFrom('2026-09-25', 7), hasPickupTime: true };
  check('mid-trip', isUnderway(running, now), true);
  check('not collected yet', isUnderway({ startDate: instantFrom('2026-09-24', 7), endDate: instantFrom('2026-09-28', 7), hasPickupTime: true }, now), false);
  check('already returned', isUnderway({ startDate: instantFrom('2026-09-10', 7), endDate: instantFrom('2026-09-14', 7), hasPickupTime: true }, now), false);
  // Judged on the calendar days it meant, not the UTC midnights it was
  // stored at, which are eight hours adrift of them.
  check('a legacy booking mid-trip', isUnderway({ startDate: new Date('2026-09-21T00:00:00Z'), endDate: new Date('2026-09-25T00:00:00Z'), hasPickupTime: false }, now), true);

  group('a refund can be taken from more than one payment');
  // PayMongo takes a refund from a specific payment and will not let it
  // exceed that payment, so a booking topped up to move dates has to be
  // unwound across both.
  const simple = paymentSources({ amountPaid: 1800, paymongoPaymentId: 'pay_first', extraPayments: [] });
  check('one payment, one source', simple.length, 1);
  check('worth what was collected', simple[0].amount, 1800);

  const topped = paymentSources({
    amountPaid: 2000,
    paymongoPaymentId: 'pay_first',
    extraPayments: [{ paymongoPaymentId: 'pay_topup', amount: 200 }],
  });
  check('a topped-up booking has two', topped.length, 2);
  // The first payment's size is not stored anywhere — it is whatever the
  // total collected is, less the top-ups we do know about.
  check('the original is worked out, not guessed', topped[0].amount, 1800);
  check('and the top-up is itself', topped[1].amount, 200);
  check('together they are everything paid', topped[0].amount + topped[1].amount, 2000);

  check('a booking that never paid has no sources', paymentSources({ amountPaid: 0, paymongoPaymentId: '', extraPayments: [] }).length, 0);

  group('a breakdown refunds the days they paid for and did not get');
  // One refund rule whoever broke it: we do not keep money for days nobody
  // had the vehicle. Fault is priced in the repair bill instead, which is
  // easier to explain and usually the larger figure.
  const fiveDays = {
    payment: 'paid', amountPaid: 10000, totalPrice: 10000, totalDays: 5,
    startDate: instantFrom('2026-09-25', 7), endDate: instantFrom('2026-09-30', 7), hasPickupTime: true,
  };
  // Built by arithmetic rather than by pasting a day number into a string,
  // which quietly produced "2026-09-33" and an Invalid Date.
  const onDay = (n, hour = 12) =>
    new Date(instantFrom('2026-09-24', 0).getTime() + n * 86400000 + hour * 3600000);

  check('breaks on day one, ours', refundAmountFor(fiveDays, 'breakdown', onDay(1)), 10000);
  check('breaks on day one, theirs', refundAmountFor(fiveDays, 'breakdown_client', onDay(1)), 8000);
  check('breaks on day four, ours', refundAmountFor(fiveDays, 'breakdown', onDay(4)), 4000);
  check('breaks on day four, theirs', refundAmountFor(fiveDays, 'breakdown_client', onDay(4)), 2000);
  // The day it broke is the only place fault touches the money.
  check('one day apart, always', 
    refundAmountFor(fiveDays, 'breakdown', onDay(3)) - refundAmountFor(fiveDays, 'breakdown_client', onDay(3)), 2000);

  group('a deposit is not refunded past what it covered');
  // Paid 20% and used 60% of the trip: nothing comes back, and certainly
  // not a negative number.
  const deposit = { ...fiveDays, amountPaid: 2000 };
  check('used more than they paid for', refundAmountFor(deposit, 'breakdown', onDay(4)), 0);
  check('never collected at all', unusedDayRefund(deposit, { chargeBrokenDay: false }, onDay(0)), 2000);

  group('a breakdown is only a breakdown once somebody has the vehicle');
  check('refused before pickup', !!reasonUnavailable({ collectedAt: null }, 'breakdown'), true);
  check('allowed once collected', reasonUnavailable({ collectedAt: new Date() }, 'breakdown'), null);

  group('a vehicle that never came back');
  // They have had the trip and more, so there are no unused days to return.
  // Worked out rather than hardcoded to zero, so the sum still holds if it
  // is ever used on a booking cancelled part-way through.
  check('nothing left to refund', refundAmountFor(fiveDays, 'not_returned', onDay(6)), 0);
  check('nor once well past the end', refundAmountFor(fiveDays, 'not_returned', onDay(9)), 0);
  // Same day count as the client-fault breakdown: the day they ended it on
  // was a day they had.
  check('counts the current day as used', 
    refundAmountFor(fiveDays, 'not_returned', onDay(2)), refundAmountFor(fiveDays, 'breakdown_client', onDay(2)));

  group('it cannot be used on a vehicle nobody collected');
  check('refused before pickup', !!reasonUnavailable({ collectedAt: null }, 'not_returned'), true);
  check('allowed once collected', reasonUnavailable({ collectedAt: new Date() }, 'not_returned'), null);

  group('the band a pickup falls in, before the booking exists');
  // The whole reason this helper exists: asked through refundOutcome with
  // createdAt = now, every prospective booking answers "mistake, 100%",
  // which hides the band that applies a minute after paying. These two
  // must disagree, or the confirm screen is quoting the wrong rule.
  const soon = { createdAt: now, startDate: hoursAhead(5, now) };
  check('refundOutcome calls a fresh same-day booking a mistake', refundOutcome(soon, now).basis, 'mistake');
  check('noticeBand calls the same pickup unrefundable', noticeBand(soon.startDate, now).band, 'mistakeOnly');

  check('a month out', noticeBand(hoursAhead(24 * 30, now), now).band, 'full');
  check('exactly three days', noticeBand(hoursAhead(72, now), now).band, 'full');
  check('an hour inside three days', noticeBand(hoursAhead(71, now), now).band, 'half');
  check('exactly one day', noticeBand(hoursAhead(24, now), now).band, 'half');
  check('an hour inside one day', noticeBand(hoursAhead(23, now), now).band, 'mistakeOnly');
  // Past this line even the undo is gone, so the wording promises nothing.
  check('exactly two hours out', noticeBand(hoursAhead(2, now), now).band, 'none');
  check('an hour before pickup', noticeBand(hoursAhead(1, now), now).band, 'none');
  check('pickup already passed', noticeBand(hoursAhead(-3, now), now).band, 'none');
  // No dates picked yet: the panel falls back to stating the rule, so this
  // must not read as a band with a deadline attached.
  check('no pickup at all', noticeBand(null, now).band, 'unknown');

  // Each band agrees with what the client would actually be paid once the
  // mistake window has closed, which is the promise the wording makes.
  check('full band pays everything', refundPercentage(settled(24 * 30), now), 100);
  check('half band pays half', refundPercentage(settled(48), now), 50);
  check('mistakeOnly band pays nothing on notice', refundPercentage(settled(5), now), 0);
}
