import { suite, group, check, checkRefused } from './harness.mjs';
import {
  PAYOUT_METHODS,
  methodLabel,
  referenceRequired,
  cleanReference,
  isPayable,
  isComing,
  finishedAt,
  daysWaiting,
  WAITING_WARN_DAYS,
  owedSummary,
  payoutProblem,
  voidProblem,
  isLive,
} from '../utils/payouts.js';
import { splitFor } from '../utils/revenueShare.js';

export default function run() {
  suite('Consignments · payouts');

  const share = (b) => splitFor(b).owner;

  // A finished trip: the money is in and the vehicle is back.
  const done = (id, subtotal, endedOn, extra = {}) => ({
    _id: id,
    status: 'completed',
    subtotal,
    totalPrice: subtotal,
    ownerShare: { percent: 80 },
    endDate: new Date(endedOn),
    returnedAt: new Date(endedOn),
    ...extra,
  });

  // Agreed and paid for, but the vehicle has not gone out yet.
  const coming = (id, subtotal, startsOn) => ({
    _id: id,
    status: 'confirmed',
    subtotal,
    totalPrice: subtotal,
    ownerShare: { percent: 80 },
    startDate: new Date(startsOn),
    endDate: new Date(startsOn),
  });

  group('What can be paid out at all');

  check('a finished trip can be', isPayable(done('a', 3000, '2026-10-30')), true);
  check('a confirmed one cannot', isPayable(coming('b', 3000, '2026-11-20')), false);
  check('but it is counted as coming', isComing(coming('b', 3000, '2026-11-20')), true);
  check('a pending booking is neither', isPayable({ status: 'pending' }) || isComing({ status: 'pending' }), false);
  check('and a cancelled one is neither', isPayable({ status: 'cancelled' }) || isComing({ status: 'cancelled' }), false);

  // The rule that stops us paying out money we may have to give back. A
  // confirmed booking can still be cancelled and refunded, so an owner
  // paid on the confirmation would be holding a share of a refund.
  group('Owed is not the same figure as earned');

  const mixed = [
    done('t1', 6000, '2026-10-30'),
    done('t2', 4000, '2026-11-05'),
    coming('t3', 6000, '2026-11-20'),
  ];
  const all = owedSummary({ bookings: mixed, share });

  check('only finished trips are owed', all.owed, 8000);
  check('the upcoming one is reported separately', all.coming, 4800);
  check('and it is not in the list to tick off', all.payable.length, 2);

  group('What has already been paid drops out');

  const settled = owedSummary({ bookings: mixed, share, paidIds: new Set(['t1']) });
  check('a paid trip is no longer owed', settled.owed, 3200);
  check('and no longer offered for payment', settled.payable.map((p) => String(p.booking._id)).join(), 't2');
  check('paying everything leaves nothing owed',
    owedSummary({ bookings: mixed, share, paidIds: new Set(['t1', 't2']) }).owed, 0);
  check('but what is coming is untouched by payments',
    owedSummary({ bookings: mixed, share, paidIds: new Set(['t1', 't2']) }).coming, 4800);

  group('How long somebody has been waiting');

  check('the oldest unpaid trip sets it',
    all.oldestUnpaidAt.toISOString().slice(0, 10), '2026-10-30');
  check('paying that one moves it to the next',
    settled.oldestUnpaidAt.toISOString().slice(0, 10), '2026-11-05');
  check('with nothing owed there is no date',
    owedSummary({ bookings: mixed, share, paidIds: new Set(['t1', 't2']) }).oldestUnpaidAt, null);
  check('trips are offered oldest first',
    all.payable.map((p) => String(p.booking._id)).join(), 't1,t2');

  const now = new Date('2026-11-08T10:00:00Z');
  check('nine days is nine days', daysWaiting(new Date('2026-10-30T10:00:00Z'), now), 9);
  check('part of a day does not count as one', daysWaiting(new Date('2026-11-08T01:00:00Z'), now), 0);
  check('a date in the future is not negative waiting',
    daysWaiting(new Date('2026-12-01T10:00:00Z'), now), 0);
  check('nothing owed means nothing waiting', daysWaiting(null, now), 0);
  check('the warning threshold is a fortnight', WAITING_WARN_DAYS, 14);

  group('When the trip actually ended');

  // returnedAt is the truth; endDate stands in for the bookings that
  // finished before that field existed, where it is the same day anyway.
  check('the handback date wins',
    finishedAt({ returnedAt: new Date('2026-10-31'), endDate: new Date('2026-10-30') })
      .toISOString().slice(0, 10), '2026-10-31');
  check('with no handback recorded the booked end stands in',
    finishedAt({ endDate: new Date('2026-10-30') }).toISOString().slice(0, 10), '2026-10-30');
  check('and with neither there is no date', finishedAt({}), null);

  group('A trip left out of the period is still owed');

  // The bug this guards: filtering the booking query by period would make
  // an unpaid August trip vanish from what is owed in November. owedSummary
  // is never given a period for exactly that reason.
  const old = [done('aug', 10000, '2026-08-12'), done('nov', 5000, '2026-11-05')];
  check('an old unpaid trip still counts', owedSummary({ bookings: old, share }).owed, 12000);
  check('and it is the one that has been waiting',
    owedSummary({ bookings: old, share }).oldestUnpaidAt.toISOString().slice(0, 10), '2026-08-12');

  group('Trips agreed before the split keep their own terms');

  const preSplit = { _id: 'pre', status: 'completed', subtotal: 2000, totalPrice: 2000, endDate: new Date('2026-06-01') };
  check('nothing recorded means the whole rental is theirs',
    owedSummary({ bookings: [preSplit], share }).owed, 2000);

  group('What a payment is allowed to be');

  checkRefused('no method is refused',
    payoutProblem({ bookingIds: ['t1'] }), 'how the money was sent');
  checkRefused('an invented method is refused',
    payoutProblem({ method: 'bitcoin', bookingIds: ['t1'] }), 'how the money was sent');
  checkRefused('no trips is refused',
    payoutProblem({ method: 'cash', bookingIds: [] }), 'at least one trip');
  checkRefused('GCash without a reference is refused',
    payoutProblem({ method: 'gcash', bookingIds: ['t1'] }), 'reference');
  checkRefused('and whitespace is not a reference',
    payoutProblem({ method: 'gcash', reference: '   ', bookingIds: ['t1'] }), 'reference');
  check('GCash with one is allowed',
    payoutProblem({ method: 'gcash', reference: '0031 7720 1194', bookingIds: ['t1'] }), '');
  check('cash needs no reference',
    payoutProblem({ method: 'cash', bookingIds: ['t1'] }), '');
  check('nor does a bank transfer',
    payoutProblem({ method: 'bank', bookingIds: ['t1'] }), '');

  check('only GCash insists on one', referenceRequired('gcash'), true);
  check('cash does not', referenceRequired('cash'), false);
  check('the three ways money travels', PAYOUT_METHODS.join(), 'gcash,cash,bank');
  check('GCash is written the way the app writes it', methodLabel('gcash'), 'GCash');
  check('and an unknown method says so rather than guessing', methodLabel('cheque'), 'Unknown');
  check('a reference keeps its grouping but loses the slop',
    cleanReference('  0031   7720 1194  '), '0031 7720 1194');
  check('and a missing one is empty, not "undefined"', cleanReference(undefined), '');

  group('Voiding says why');

  checkRefused('a blank reason is refused', voidProblem(''), 'say why');
  checkRefused('and so is a shrug', voidProblem('x'), 'say why');
  check('a real reason is accepted', voidProblem('Sent twice by mistake.'), '');
  check('a voided payment stops counting', isLive({ status: 'void' }), false);
  check('a recorded one counts', isLive({ status: 'recorded' }), true);
  check('and one with nothing recorded counts too', isLive({}), true);
}
