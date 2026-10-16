// What a client's own booking says about itself: its tone, its sentence,
// its money and what they can do about it. Thirteen states, all of which
// a real client in the live data is sitting in right now.

import { suite, group, check } from './harness.mjs';
import {
  moneyFor, moneySummary, stepOf, toneOf, isLive, sentenceFor, actionKeysFor,
} from '../utils/myBookings.js';

export default function run() {
  suite('Client · my bookings');

  const now = new Date('2026-10-16T04:00:00Z'); // noon in Manila

  const booking = (over = {}) => ({
    _id: 'b1',
    status: 'confirmed',
    car: { brand: 'Toyota', model: 'Vios', pricePerDay: 2000 },
    totalDays: 1,
    totalPrice: 2000,
    amountPaid: 400,
    startDate: '2026-10-18T23:00:00Z',
    endDate: '2026-10-19T23:00:00Z',
    payment: 'paid',
    refundStatus: 'none',
    ...over,
  });

  group('the money, in one shape');
  const plain = moneyFor(booking());
  check('the rental is a line', plain.lines[0].label, '1 day × ₱2,000');
  check('what it costs', plain.cost, 2000);
  check('what has been paid', plain.paid, 400);
  check('what is left', plain.owe, 1600);
  check('and when it is wanted', plain.oweWhen, 'at pickup');
  check('said in one line', moneySummary(plain), '₱2,000 · ₱1,600 to pay at pickup');

  // A discount is money the client never has to find.
  const discounted = moneyFor(booking({ discountAmount: 300, promoLabel: 'Promo ALBAY300', totalPrice: 1700 }));
  check('a discount subtracts', discounted.lines[1].amount, -300);
  check('and is named', discounted.lines[1].label, 'Promo ALBAY300');
  check('leaving less to find', discounted.owe, 1300);

  group('charges after a trip');
  const charged = booking({
    status: 'completed',
    amountPaid: 2000,
    collectedAt: '2026-10-12T23:00:00Z',
    returnedAt: '2026-10-14T05:00:00Z',
    endDate: '2026-10-13T23:00:00Z',
    lateFee: { days: 1, amount: 2000 },
    fuel: { charge: 350 },
  });
  const after = moneyFor(charged);
  check('the late fee is a line', after.lines.some((l) => l.label.startsWith('Late fee')), true);
  check('said in hours, as everywhere else', after.lines.find((l) => l.label.startsWith('Late fee')).label, 'Late fee · 6 h late');
  check('fuel too', after.lines.some((l) => l.label === 'Fuel'), true);
  check('all of it owed', after.owe, 2350);
  check('and wanted now', after.oweWhen, 'now');
  // A charge somebody has already collected is not owed twice.
  const settled = moneyFor({ ...charged, lateFee: { days: 1, amount: 2000, collectedAt: '2026-10-14T06:00:00Z' } });
  check('a collected charge drops out', settled.owe, 350);

  group('a cancelled booking owes nothing');
  const refunded = moneyFor(booking({ status: 'cancelled', amountPaid: 400, refundStatus: 'approved', refundAmount: 400 }));
  check('nothing to collect', refunded.owe, 0);
  check('money came back', refunded.back, 400);
  check('said in one line', moneySummary(refunded), '₱400 paid · ₱400 came back');
  check('nothing paid, nothing charged', moneySummary(moneyFor(booking({ status: 'cancelled', amountPaid: 0 }))), 'Nothing was charged');

  group('how far along it is');
  check('asked for', stepOf(booking({ status: 'pending' })), 0);
  check('confirmed', stepOf(booking()), 1);
  check('out with the client', stepOf(booking({ collectedAt: '2026-10-12T23:00:00Z' })), 2);
  check('back', stepOf(charged), 3);

  group('how loudly it speaks');
  const overdue = booking({ collectedAt: '2026-10-12T23:00:00Z', endDate: '2026-10-15T23:00:00Z' });
  check('a vehicle not brought back is red', toneOf(overdue, now), 'red');
  check('a refund turned down is red', toneOf(booking({ status: 'cancelled', refundStatus: 'declined' }), now), 'red');
  check('an unfinished payment wants doing', toneOf(booking({ payment: 'gcash_pending' }), now), 'amber');
  check('an offer waiting on the client wants doing', toneOf(booking({ adjustOffer: { status: 'pending' } }), now), 'amber');
  check('a trip with money still owed wants doing', toneOf(charged, now), 'amber');
  check('a finished trip nobody rated wants doing', toneOf(booking({ status: 'completed', amountPaid: 2000 }), now), 'amber');
  check('a request the office has not answered waits', toneOf(booking({ status: 'pending' }), now), 'wait');
  check('so does a date change', toneOf(booking({ rescheduleRequest: { status: 'pending' } }), now), 'wait');
  check('a confirmed trip is in hand', toneOf(booking(), now), 'ok');
  check('a settled trip is done', toneOf(booking({ status: 'completed', amountPaid: 2000, carRating: { rating: 5 } }), now), 'done');

  group('what belongs at the top of the page');
  check('a booking nobody has answered', isLive(booking({ status: 'pending' }), now), true);
  check('a trip still ahead', isLive(booking(), now), true);
  check('a trip with money owed', isLive(charged, now), true);
  check('a refund being decided', isLive(booking({ status: 'cancelled', refundStatus: 'requested' }), now), true);
  // An unrated trip is worth a nudge, not a place at the top.
  check('a finished trip nobody rated is history',
    isLive(booking({ status: 'completed', amountPaid: 2000 }), now), false);
  check('a settled cancellation is history',
    isLive(booking({ status: 'cancelled', refundStatus: 'approved', refundAmount: 400 }), now), false);

  group('what it says out loud');
  check('waiting on the office', sentenceFor(booking({ status: 'pending' }), now), 'Waiting for the office to confirm');
  check('still out and late',
    sentenceFor(overdue, now).startsWith('Due back at'), true);
  check('cancelled with money back',
    sentenceFor(booking({ status: 'cancelled', refundStatus: 'approved', refundAmount: 400 }), now), 'Cancelled — ₱400 refunded');
  check('cancelled, nothing charged',
    sentenceFor(booking({ status: 'cancelled', amountPaid: 0 }), now), 'Cancelled — nothing was charged');
  check('finished and rated',
    sentenceFor(booking({ status: 'completed', amountPaid: 2000, carRating: { rating: 5 } }), now), 'Returned on time · you gave it 5 stars');
  check('finished, not rated',
    sentenceFor(booking({ status: 'completed', amountPaid: 2000 }), now), 'Returned on time · not rated yet');
  check('money still owed after a trip',
    sentenceFor(charged, now).endsWith('₱2,350 left to pay'), true);

  group('what the client may do');
  check('a trip ahead can be questioned or asked back',
    actionKeysFor(booking(), now), ['dates', 'refund']);
  // Asking twice is not a thing: the office already has the question.
  check('not while a date change is pending',
    actionKeysFor(booking({ rescheduleRequest: { status: 'pending' } }), now), ['refund']);
  check('nor while a refund is being decided',
    actionKeysFor(booking({ refundStatus: 'requested' }), now), ['dates']);
  check('an offer leaves one thing to do',
    actionKeysFor(booking({ adjustOffer: { status: 'pending' } }), now), ['offer']);
  check('an unfinished payment leaves one thing to do',
    actionKeysFor(booking({ payment: 'gcash_pending' }), now), ['pay']);
  check('a vehicle still out can be kept longer',
    actionKeysFor(overdue, now), ['longer', 'call']);
  check('a finished trip with money owed',
    actionKeysFor(charged, now), ['pay', 'rate', 'call']);
  check('a cancelled booking nobody asked about',
    actionKeysFor(booking({ status: 'cancelled' }), now), ['refund']);
  check('and one already asked about',
    actionKeysFor(booking({ status: 'cancelled', refundStatus: 'requested' }), now), []);
}
