import { suite, group, check, checkRefused } from './harness.mjs';
import { promoCoversRange, promoHasEnded, computeBookingPrice, validatePromo } from '../utils/promo.js';
import { instantFrom } from '../utils/phTime.js';

// A promo running Sep 20–25, stored the way a date picker stores it.
const promo = {
  label: 'September Sale',
  type: 'percent',
  value: 15,
  startDate: new Date('2026-09-20T00:00:00Z'),
  endDate: new Date('2026-09-25T00:00:00Z'),
};

const car = { _id: 'c1', pricePerDay: 2000, promo };
const plainCar = { _id: 'c1', pricePerDay: 2000 };

export default function run() {
  suite('Pricing, promos and long-rental discounts');

  group('a promo covers the first day of its own window');
  // 7:00 AM in Legazpi is 11:00 PM the day BEFORE in UTC, so comparing the
  // raw instants threw a client off the first day of every promo they
  // booked on.
  check('booked 7:00 AM on the 20th', promoCoversRange(promo, instantFrom('2026-09-20', 7), instantFrom('2026-09-23', 7)), true);
  check('booked 8:00 PM on the 20th', promoCoversRange(promo, instantFrom('2026-09-20', 20), instantFrom('2026-09-23', 20)), true);

  group('and the edges hold');
  check('starting the day before does not qualify', promoCoversRange(promo, instantFrom('2026-09-19', 7), instantFrom('2026-09-22', 7)), false);
  check('returning on the last day qualifies', promoCoversRange(promo, instantFrom('2026-09-22', 7), instantFrom('2026-09-25', 7)), true);
  check('returning the day after does not', promoCoversRange(promo, instantFrom('2026-09-22', 7), instantFrom('2026-09-26', 7)), false);
  check('a booking with no time still works', promoCoversRange(promo, new Date('2026-09-20T00:00:00Z'), new Date('2026-09-23T00:00:00Z')), true);
  check('and so do the plain date strings the site sends', promoCoversRange(promo, '2026-09-20', '2026-09-23'), true);

  group('it ends when the last day ends in Legazpi');
  check('3:00 PM on the 25th, still running', promoHasEnded(promo, instantFrom('2026-09-25', 15)), false);
  check('1:00 AM on the 26th, over', promoHasEnded(promo, instantFrom('2026-09-26', 1)), true);

  group('what a booking actually costs');
  const inWindow = computeBookingPrice(car, 3, instantFrom('2026-09-20', 7), instantFrom('2026-09-23', 7), []);
  check('3 days at 2,000 less 15%', inWindow.totalPrice, 5100);
  check('the receipt keeps the full price', inWindow.subtotal, 6000);
  check('and what came off', inWindow.discountAmount, 900);
  check('labelled with what the client chose', inWindow.promoLabel, 'September Sale');

  const outOfWindow = computeBookingPrice(car, 3, instantFrom('2026-10-20', 7), instantFrom('2026-10-23', 7), []);
  check('outside the window, no discount', outOfWindow.totalPrice, 6000);
  check('and nothing is labelled', outOfWindow.promoLabel, '');

  group('a promo and a long-rental rule never stack');
  const rules = [{ _id: 'r1', minDays: 7, percent: 10, appliesTo: 'all', cars: [], active: true }];
  // 7 days: the promo takes 15% (2,100) and the rule 10% (1,400). The
  // client gets the bigger one, not both.
  const both = computeBookingPrice(car, 7, instantFrom('2026-09-20', 7), instantFrom('2026-09-25', 7), rules);
  check('the bigger discount wins', both.discountAmount, 2100);
  check('and it is the promo', both.promoLabel, 'September Sale');
  check('not the two added together', both.totalPrice, 11900);

  const ruleOnly = computeBookingPrice(plainCar, 7, instantFrom('2026-10-01', 7), instantFrom('2026-10-08', 7), rules);
  check('with no promo, the rule applies', ruleOnly.discountAmount, 1400);
  check('and says so', ruleOnly.promoLabel, 'Long-rental discount (7+ days)');

  const tooShort = computeBookingPrice(plainCar, 6, instantFrom('2026-10-01', 7), instantFrom('2026-10-07', 7), rules);
  check('a 6-day trip does not qualify', tooShort.discountAmount, 0);

  group('extending before pickup reprices the whole booking');
  // The worked example: 5 days at 2,000 is 10,000 with no discount. Going
  // to 7 crosses the 7+ rule, so the discount lands on the WHOLE booking —
  // and the two extra days cost 2,600 rather than the 4,000 they would at
  // the plain rate. Extending made the trip cheaper per day.
  const fiveDays = computeBookingPrice(plainCar, 5, instantFrom('2026-10-01', 7), instantFrom('2026-10-06', 7), rules);
  const sevenDays = computeBookingPrice(plainCar, 7, instantFrom('2026-10-01', 7), instantFrom('2026-10-08', 7), rules);
  check('what they booked', fiveDays.totalPrice, 10000);
  check('what it becomes', sevenDays.totalPrice, 12600);
  check('due now to extend', sevenDays.totalPrice - fiveDays.totalPrice, 2600);
  check('two days at the plain rate would have been', 2 * plainCar.pricePerDay, 4000);
  check('the discount is named on the receipt', sevenDays.promoLabel, 'Long-rental discount (7+ days)');

  group('extending once they have the vehicle does not reprice it');
  // The days they already paid for keep the price they agreed, and the
  // extra ones are charged at the standard rate. The discount is for
  // committing in advance, which extending mid-trip is not.
  const midTripExtra = 2 * plainCar.pricePerDay;
  check('two more days', midTripExtra, 4000);
  check('new total', fiveDays.totalPrice + midTripExtra, 14000);
  check('which is dearer than booking 7 up front', (fiveDays.totalPrice + midTripExtra) > sevenDays.totalPrice, true);

  group('extending can never hand money back');
  // More days always costs more — the only way it could fall is a discount
  // steep enough to make a longer trip cheaper, which the inversion guard
  // refuses to let an admin create.
  let neverCheaper = true;
  for (let days = 1; days <= 40; days++) {
    const shorter = computeBookingPrice(plainCar, days, instantFrom('2026-10-01', 7), instantFrom(`2026-10-01`, 7), rules);
    const longer = computeBookingPrice(plainCar, days + 1, instantFrom('2026-10-01', 7), instantFrom('2026-10-01', 7), rules);
    if (longer.totalPrice <= shorter.totalPrice) neverCheaper = false;
  }
  check('one more day always costs more, 1 to 40 days', neverCheaper, true);

  group('a promo can never take a booking below zero');
  const steep = { ...car, promo: { ...promo, type: 'amount', value: 5000 } };
  const clamped = computeBookingPrice(steep, 1, instantFrom('2026-09-21', 7), instantFrom('2026-09-22', 7), []);
  check('a fixed amount is capped at the subtotal', clamped.totalPrice, 0);

  group('what admin is allowed to set up');
  check('a sensible promo is accepted', validatePromo({ label: 'Sale', type: 'percent', value: 15, startDate: '2026-09-20', endDate: '2026-09-25' }, car), null);
  checkRefused('over 50% is refused', validatePromo({ label: 'Sale', type: 'percent', value: 60, startDate: '2026-09-20', endDate: '2026-09-25' }, car), '50%');
  checkRefused('a fixed amount above a day\'s rate is refused', validatePromo({ label: 'Sale', type: 'amount', value: 2500, startDate: '2026-09-20', endDate: '2026-09-25' }, car), 'less than one day');
  checkRefused('an unnamed promo is refused', validatePromo({ label: '', type: 'percent', value: 10, startDate: '2026-09-20', endDate: '2026-09-25' }, car), 'name');
  checkRefused('ending before it starts is refused', validatePromo({ label: 'Sale', type: 'percent', value: 10, startDate: '2026-09-25', endDate: '2026-09-20' }, car), 'cannot end');
}
