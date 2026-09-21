import { suite, group, check } from './harness.mjs';
import { getRefundPercentage, refundAmountFor, isUnderway } from '../utils/cancelBooking.js';
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
  check('vehicle unavailable, fresh booking', refundAmountFor(paid(), 'vehicle_unavailable', null, now), 2000);
  check('vehicle unavailable, week-old booking', refundAmountFor(paid({ createdAt: hoursAgo(24 * 7, now) }), 'vehicle_unavailable', null, now), 2000);

  group('a client changing their mind gets the normal policy');
  // Deliberately the same tiers as the in-app refund button, so nobody past
  // the window can get a full refund just by messaging admin instead.
  check('within 12 hours', refundAmountFor(paid(), 'client_requested', null, now), 2000);
  check('within 24 hours', refundAmountFor(paid({ createdAt: hoursAgo(20, now) }), 'client_requested', null, now), 1000);
  check('after 24 hours', refundAmountFor(paid({ createdAt: hoursAgo(30, now) }), 'client_requested', null, now), 0);

  group('an amount admin sets by hand is bounded');
  check('a sensible figure', refundAmountFor(paid(), 'other', 600, now), 600);
  check('more than was ever paid is capped', refundAmountFor(paid(), 'other', 5000, now), 2000);
  check('a negative figure is nothing', refundAmountFor(paid(), 'other', -500, now), 0);
  check('nonsense is nothing', refundAmountFor(paid(), 'other', 'lots', now), 0);

  group('nothing comes back from a booking that never paid');
  check('never paid', refundAmountFor(paid({ payment: 'offline' }), 'vehicle_unavailable', null, now), 0);
  check('abandoned at GCash', refundAmountFor(paid({ payment: 'gcash_pending' }), 'vehicle_unavailable', null, now), 0);
  check('paid nothing', refundAmountFor(paid({ amountPaid: 0 }), 'vehicle_unavailable', null, now), 0);

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
}
