import { suite, group, check } from './harness.mjs';
import { getRefundPercentage, refundAmountFor, isUnderway, reasonUnavailable, CANCEL_REASONS, unusedDayRefund } from '../utils/cancelBooking.js';
import { paymentSources } from '../utils/paymongo.js';
import { instantFrom } from '../utils/phTime.js';

const hoursAgo = (n, now) => new Date(now.getTime() - n * 60 * 60 * 1000);
const now = new Date('2026-09-22T12:00:00+08:00');

const paid = (over = {}) => ({
  payment: 'paid',
  amountPaid: 2000,
  createdAt: hoursAgo(1, now),
  ...over,
});

export default function run() {
  suite('Refunds');

  group('the tiers, measured from when the booking was made');
  check('within 12 hours', getRefundPercentage(hoursAgo(1, now), now), 100);
  check('at 12 hours', getRefundPercentage(hoursAgo(12, now), now), 100);
  check('at 13 hours', getRefundPercentage(hoursAgo(13, now), now), 50);
  check('at 24 hours', getRefundPercentage(hoursAgo(24, now), now), 50);
  check('after 24 hours', getRefundPercentage(hoursAgo(25, now), now), 0);
  check('a week later', getRefundPercentage(hoursAgo(24 * 7, now), now), 0);

  group('why it was cancelled decides what comes back');
  // The business pulled the vehicle, so the tiers — which exist to price a
  // client changing their mind — have nothing to say about it.
  check('vehicle unavailable, fresh booking', refundAmountFor(paid(), 'vehicle_unavailable', now), 2000);
  check('vehicle unavailable, week-old booking', refundAmountFor(paid({ createdAt: hoursAgo(24 * 7, now) }), 'vehicle_unavailable', now), 2000);

  group('a client changing their mind gets the normal policy');
  // Deliberately the same tiers as the in-app refund button, so nobody past
  // the window can get a full refund just by messaging admin instead.
  check('within 12 hours', refundAmountFor(paid(), 'client_requested', now), 2000);
  check('within 24 hours', refundAmountFor(paid({ createdAt: hoursAgo(20, now) }), 'client_requested', now), 1000);
  check('after 24 hours', refundAmountFor(paid({ createdAt: hoursAgo(30, now) }), 'client_requested', now), 0);

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
  const beforePickup = CANCEL_REASONS.filter((r) => !r.startsWith('breakdown'));
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
  const onDay = (n, hour = 12) => new Date(`2026-09-${String(24 + n).padStart(2, '0')}T${hour}:00:00+08:00`);

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
}
