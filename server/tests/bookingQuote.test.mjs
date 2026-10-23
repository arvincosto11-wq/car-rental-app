import { suite, group, check } from './harness.mjs';
import { quoteBooking, depositOn, daysFor, DEPOSIT_PCT } from '../utils/bookingQuote.js';
import { DEFAULTS } from '../utils/delivery.js';
import { instantFrom } from '../utils/phTime.js';

// The office, Legazpi (₱265 a leg) and Tabaco (₱638 a leg) — the same three
// places the delivery tests price, so a change there shows up here as a
// changed total rather than a silently different quote.
const OFFICE = null;
const LEGAZPI = { lat: 13.1391, lng: 123.7438 };
const TABACO = { lat: 13.3587, lng: 123.7330 };
const MANILA = { lat: 14.5995, lng: 120.9842 };

// Nothing saved: the defaults, which is what the system quotes on the day
// it launches.
const unset = null;

const promo = {
  label: 'September Sale',
  type: 'percent',
  value: 15,
  startDate: new Date('2026-09-20T00:00:00Z'),
  endDate: new Date('2026-09-30T00:00:00Z'),
};

const plainCar = { _id: 'c1', pricePerDay: 2000 };
const promoCar = { _id: 'c1', pricePerDay: 2000, promo };

// A whole-day span, built from one pickup hour at both ends — which is what
// the booking form sends.
const span = (fromDay, toDay, hour = 7) => ({
  start: instantFrom(`2026-09-${fromDay}`, hour),
  end: instantFrom(`2026-09-${toDay}`, hour),
});

const sevenDays = { minDays: 7, percent: 10, appliesTo: 'all', active: true };

export default function run() {
  suite('What a booking costs, end to end');

  group('the plain booking');
  const plain = quoteBooking({ car: plainCar, ...span(20, 23), settings: unset });
  check('three days', plain.totalDays, 3);
  check('at the daily rate', plain.subtotal, 6000);
  check('nothing off', plain.discountAmount, 0);
  check('collected at the office, so no fee', plain.deliveryFee, 0);
  check('total', plain.totalPrice, 6000);
  check('a fifth to book', plain.depositDue, 1200);
  check('the rest at pickup', plain.balanceDue, 4800);
  check('one line on the receipt', plain.lines.length, 1);
  check('and it shows the working', plain.lines[0].label, '3 days × ₱2,000');

  group('a single day reads as one day, not 1 days');
  check('label', quoteBooking({ car: plainCar, ...span(20, 21), settings: unset }).lines[0].label, '1 day × ₱2,000');

  group('a promo comes off the rental');
  const promoed = quoteBooking({ car: promoCar, ...span(20, 23), settings: unset });
  check('15% of 6,000', promoed.discountAmount, 900);
  check('total', promoed.totalPrice, 5100);
  check('named on the receipt', promoed.discountLabel, 'September Sale');
  check('as a negative line', promoed.lines[1].amount, -900);
  check('deposit follows the discounted total', promoed.depositDue, 1020);

  group('a trip outside the window pays full price');
  const outside = quoteBooking({ car: promoCar, ...span(10, 13), settings: unset });
  check('no discount', outside.discountAmount, 0);
  check('total', outside.totalPrice, 6000);
  check('and no discount line', outside.lines.length, 1);
  check('and no kind to name', outside.discountKind, '');

  group('promo and long-rental never stack — the bigger one wins');
  // Seven days: the promo takes 15% of 14,000 (2,100), the long-rental rule
  // takes 10% (1,400). The customer gets the promo.
  const both = quoteBooking({ car: promoCar, ...span(20, 27), settings: unset, longRentalRules: [sevenDays] });
  check('seven days', both.totalDays, 7);
  check('the promo wins', both.discountAmount, 2100);
  check('and it is the promo that is named', both.discountLabel, 'September Sale');
  check('and the form is told which one won', both.discountKind, 'promo');
  check('total', both.totalPrice, 11900);

  group('and the other way round when the rule is worth more');
  const smallPromo = { ...promoCar, promo: { ...promo, type: 'amount', value: 500 } };
  const ruleWins = quoteBooking({ car: smallPromo, ...span(20, 27), settings: unset, longRentalRules: [sevenDays] });
  check('the long-rental rule wins', ruleWins.discountAmount, 1400);
  check('and names itself', ruleWins.discountLabel.includes('7'), true);
  check('and says so', ruleWins.discountKind, 'longRental');

  group('a trip too short for the rule does not get it');
  check('three days', quoteBooking({ car: plainCar, ...span(20, 23), settings: unset, longRentalRules: [sevenDays] }).discountAmount, 0);

  group('delivery is added after the discount, never inside it');
  const delivered = quoteBooking({
    car: promoCar, ...span(20, 23), pickupPoint: LEGAZPI, returnPoint: OFFICE, settings: unset,
  });
  // 15% of the RENTAL is 900. Were the fee inside the discount it would be
  // 15% of 6,265 — and a promo would quietly be paying for the drive out.
  check('the discount is still 15% of the rental alone', delivered.discountAmount, 900);
  check('the fee is the full fee', delivered.deliveryFee, 265);
  check('total', delivered.totalPrice, 5365);
  check('a delivery line appears', delivered.lines[2].key, 'delivery');
  check('with the distance on it', delivered.lines[2].label, 'Delivery · 13.6 km');
  check('and no collection line, since it comes back to the office', delivered.lines.length, 3);

  group('two drives are two lines');
  const bothLegs = quoteBooking({
    car: plainCar, ...span(20, 23), pickupPoint: LEGAZPI, returnPoint: TABACO, settings: unset,
  });
  check('delivery out and collection back', bothLegs.deliveryFee, 903);
  check('delivery line', bothLegs.lines[1].amount, 265);
  check('collection line', bothLegs.lines[2].amount, 638);
  check('total', bothLegs.totalPrice, 6903);

  group('somewhere we do not serve is refused, not quoted');
  const far = quoteBooking({ car: plainCar, ...span(20, 23), pickupPoint: MANILA, settings: unset });
  check('the quote says no', far.delivery.ok, false);
  check('and says why', far.delivery.reason, 'too_far');
  check('nothing is charged for a drive we will not make', far.deliveryFee, 0);
  check('and no delivery line is offered', far.lines.length, 1);

  group('paying in full leaves nothing at the counter');
  const full = quoteBooking({ car: plainCar, ...span(20, 23), settings: unset, paymentType: 'full' });
  check('pay the whole total now', full.amountToPay, 6000);
  check('nothing owed at pickup', full.balanceDue, 0);
  check('the deposit figure is still there to show', full.depositDue, 1200);

  group('paying the deposit leaves the balance');
  const part = quoteBooking({ car: plainCar, ...span(20, 23), settings: unset, paymentType: 'downpayment' });
  check('pay the deposit now', part.amountToPay, 1200);
  check('the rest at pickup', part.balanceDue, 4800);
  check('and they add back up to the total', part.depositDue + part.balanceDue, part.totalPrice);

  group('the deposit rounds up, so the balance is never short');
  // ₱2,001 for a day: a fifth is 400.20. Rounding down would leave a balance
  // 20 centavos larger than the stated remainder.
  const odd = quoteBooking({ car: { _id: 'c2', pricePerDay: 2001 }, ...span(20, 21), settings: unset });
  check('deposit', odd.depositDue, 401);
  check('balance', odd.balanceDue, 1600);
  check('they still add up', odd.depositDue + odd.balanceDue, odd.totalPrice);
  check('the share itself', DEPOSIT_PCT, 20);
  check('nothing to pay on nothing', depositOn(0), 0);

  group('no dates chosen yet');
  const empty = quoteBooking({ car: plainCar, settings: unset });
  check('no days', empty.totalDays, 0);
  check('no subtotal', empty.subtotal, 0);
  check('no total', empty.totalPrice, 0);
  check('no deposit', empty.depositDue, 0);
  check('and an empty receipt', empty.lines.length, 0);

  group('the form can ask before the vehicle has loaded');
  // Someone arriving on a link that already carries the dates gets the
  // form rendered while the vehicle is still on its way. It must quote
  // zero, not throw.
  const noCar = quoteBooking({ car: null, ...span(20, 23), settings: unset });
  check('no rate yet', noCar.ratePerDay, 0);
  check('no total', noCar.totalPrice, 0);
  check('but the days are already known', noCar.totalDays, 3);
  check('and nothing on the receipt', noCar.lines.length, 0);
  check('nothing at all asked for', quoteBooking().totalPrice, 0);

  group('days are counted from the moments, both ends at the same hour');
  check('three nights', daysFor(instantFrom('2026-09-20', 7), instantFrom('2026-09-23', 7)), 3);
  check('late pickup, same hour back', daysFor(instantFrom('2026-09-20', 17), instantFrom('2026-09-23', 17)), 3);
  check('nothing from nothing', daysFor(null, null), 0);
  check('backwards is zero, not negative', daysFor(instantFrom('2026-09-23', 7), instantFrom('2026-09-20', 7)), 0);

  group('the quote works off the admin settings, not hard-coded rates');
  // Doubling the rate per km must double the fee. The design handoff assumed
  // ₱20/km with a 40 km limit; the real figures are admin's.
  const dearer = quoteBooking({
    car: plainCar, ...span(20, 23), pickupPoint: LEGAZPI,
    settings: { delivery: { ...DEFAULTS, ratePerKm: DEFAULTS.ratePerKm * 2 } },
  });
  check('twice the rate, twice the fee', dearer.deliveryFee, 530);
  check('and the total follows', dearer.totalPrice, 6530);
}
