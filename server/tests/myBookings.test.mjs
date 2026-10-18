// What a client's own booking says about itself: its tone, its sentence,
// its money and what they can do about it. Thirteen states, all of which
// a real client in the live data is sitting in right now.

import { suite, group, check } from './harness.mjs';
import {
  moneyFor, moneySummary, stepOf, toneOf, isLive, sentenceFor, actionKeysFor, subFor,
} from '../utils/myBookings.js';
import { lateFeeSoFar } from '../utils/adminToday.js';

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

  // A vehicle's price can be edited at any time. The receipt for a trip
  // already taken must not move with it — and the lines have to keep
  // adding up to totalPrice, which is what `owe` is worked out from.
  group('a receipt does not change when the price does');
  const oldTrip = booking({
    status: 'completed', totalDays: 2, totalPrice: 260, amountPaid: 52,
    car: { brand: 'Toyota', model: 'Corolla', pricePerDay: 2000 },
  });
  const oldMoney = moneyFor(oldTrip, now);
  check('the rate is the one that was charged', oldMoney.lines[0].label, '2 days × ₱130');
  check('not the one on the vehicle today', oldMoney.lines[0].amount, 260);
  check('so the lines agree with the total', oldMoney.cost, 260);
  check('and what is left is what is left', oldMoney.owe, 208);

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
  check('an offer waiting on the client wants doing', toneOf(booking({ adjustOffer: { status: 'open', deadline: '2026-10-20T04:00:00Z', options: [{ startDate: '2026-11-09T23:00:00Z', endDate: '2026-11-10T23:00:00Z' }] } }), now), 'amber');
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
  // A deposit leaves a balance, and that balance can be paid now rather
  // than only at the counter.
  check('a trip ahead can be paid up, questioned or asked back',
    actionKeysFor(booking(), now), ['settle', 'dates', 'refund']);
  check('nothing to settle once it is paid in full',
    actionKeysFor(booking({ amountPaid: 2000 }), now), ['dates', 'refund']);
  // Asking twice is not a thing: the office already has the question.
  check('not while a date change is pending',
    actionKeysFor(booking({ rescheduleRequest: { status: 'pending' } }), now), ['settle', 'refund']);
  check('nor while a refund is being decided',
    actionKeysFor(booking({ refundStatus: 'requested' }), now), ['settle', 'dates']);
  check('an offer leaves one thing to do',
    actionKeysFor(booking({ adjustOffer: { status: 'open', deadline: '2026-10-20T04:00:00Z', options: [{ startDate: '2026-11-09T23:00:00Z', endDate: '2026-11-10T23:00:00Z' }] } }), now), ['offer']);
  check('an unfinished payment leaves one thing to do',
    actionKeysFor(booking({ payment: 'gcash_pending' }), now), ['pay']);
  check('a vehicle still out can be kept longer',
    actionKeysFor(overdue, now), ['longer', 'call']);
  // Never 'pay'. The only online payment in the system finishes an
  // abandoned checkout, and that endpoint refuses a booking already
  // marked paid — which every finished trip is. The button's one
  // possible outcome was the error "This booking is already paid."
  check('a finished trip with charges can settle them',
    actionKeysFor(charged, now), ['settle', 'rate', 'call']);
  check('one with nothing owed just wants rating',
    actionKeysFor(booking({ status: 'completed', amountPaid: 2000 }), now), ['rate', 'call']);
  check('but an unfinished checkout still can',
    actionKeysFor(booking({ payment: 'gcash_pending' }), now), ['pay']);
  check('a cancelled booking nobody asked about',
    actionKeysFor(booking({ status: 'cancelled' }), now), ['refund']);
  check('and one already asked about',
    actionKeysFor(booking({ status: 'cancelled', refundStatus: 'requested' }), now), []);

  // 'pending' is not a status adjustOffer can hold — the model's enum is
  // none/open/accepted/declined/expired, and every other reader in the
  // system looks for 'open'. Reading the wrong word here made an offer
  // invisible on the one page the client answers it from.
  group('an offer the client has to answer');
  const offered = booking({
    adjustOffer: {
      status: 'open',
      deadline: '2026-10-20T04:00:00Z',
      options: [{ startDate: '2026-11-09T23:00:00Z', endDate: '2026-11-10T23:00:00Z' }],
    },
  });
  check('it is live', isLive(offered, now), true);
  check('it wants doing', toneOf(offered, now), 'amber');
  check('it says so', sentenceFor(offered, now).includes('pick new dates or a full refund'), true);
  // An offer nobody answered in time is settled by the office, not chased
  // here: past its deadline it stops demanding an answer.
  const lapsed = { ...offered, adjustOffer: { ...offered.adjustOffer, deadline: '2026-10-15T04:00:00Z' } };
  check('a lapsed one does not', actionKeysFor(lapsed, now).includes('offer'), false);

  group('a fine that is still running');
  const still = booking({ collectedAt: '2026-10-12T23:00:00Z', endDate: '2026-10-15T23:00:00Z', amountPaid: 2000 });
  const running = moneyFor(still, now);
  check('the receipt says so', running.lines.some((l) => l.label.startsWith('Late fee so far')), true);
  // The sentence counts whole days elapsed, the fee counts every day
  // started. A booking 5 hours over its second day reads "2 days late"
  // and costs three, so the line says which number it charged on.
  check('and on how many days it charged',
    running.lines.find((l) => l.label.startsWith('Late fee so far')).label,
    'Late fee so far · 1 day');
  // The client is quoted the counter's own figure, not a friendlier one.
  check('at the figure the counter will charge',
    running.lines.find((l) => l.label.startsWith('Late fee so far')).amount,
    lateFeeSoFar(still, 2000, now));
  check('and it is owed', running.owe, 2000);
  check('wanted when it comes back', running.oweWhen, 'when you return it');
  // Once it is written down it is not counted twice.
  const written = moneyFor({ ...still, returnedAt: '2026-10-16T04:00:00Z', lateFee: { days: 1, amount: 2000 } }, now);
  check('a recorded fee is not doubled',
    written.lines.filter((l) => l.label.startsWith('Late fee')).length, 1);

  // 2 days and 5 hours over: "2 days late" in words, three days charged.
  const wellOver = booking({ collectedAt: '2026-10-10T23:00:00Z', endDate: '2026-10-13T23:00:00Z', amountPaid: 2000 });
  const overMoney = moneyFor(wellOver, now);
  check('whole days elapsed in the sentence',
    sentenceFor(wellOver, now).endsWith('2 days late'), true);
  check('every day started in the charge',
    overMoney.lines.find((l) => l.label.startsWith('Late fee so far')).label,
    'Late fee so far · 3 days');
  check('and the money follows the charge, not the sentence',
    overMoney.lines.find((l) => l.label.startsWith('Late fee so far')).amount, 6000);

  group('what the state means for the client');
  check('a vehicle still out', subFor(still, now).startsWith('The late fee is one day’s rental (₱2,000)'), true);
  check('one not yet due',
    subFor(booking({ collectedAt: '2026-10-12T23:00:00Z', endDate: '2026-10-18T23:00:00Z' }), now),
    'Returning late adds one day’s rental (₱2,000) for each day.');
  check('a trip ahead says what to bring',
    subFor(booking(), now), 'Bring your driver’s license and ₱1,600 for the balance.');
  check('one already paid for',
    subFor(booking({ amountPaid: 2000 }), now), 'Bring your driver’s license when you pick it up.');
  check('charges after a trip are named', subFor(charged, now), 'That is ₱2,000 late fee, plus ₱350 fuel.');
  check('a date change says what holds until then',
    subFor(booking({ rescheduleRequest: { status: 'pending' } }), now).startsWith('Until they answer, it stays on'), true);
  check('an offer names the dates',
    subFor(offered, now).startsWith('The office offered'), true);
  check('a cancellation that cost nothing',
    subFor(booking({ status: 'cancelled', amountPaid: 0 }), now), 'Nothing was charged.');
}
