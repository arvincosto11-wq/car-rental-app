import { suite, group, check } from './harness.mjs';
import {
  DEFAULT_OWNER_PERCENT,
  clampPercent,
  revenueShareSettings,
  rentalCreditedFor,
  hasAgreedShare,
  agreedPercent,
  splitFor,
  sumSplit,
  afterDiscount,
  worstCaseDiscount,
} from '../utils/revenueShare.js';

export default function run() {
  suite('Consignments · revenue share');

  group('What the owner keeps');

  const at80 = (subtotal, extra = {}) => ({
    subtotal, totalPrice: subtotal, ownerShare: { percent: 80 }, ...extra,
  });

  check('the default is the owner keeping four fifths', DEFAULT_OWNER_PERCENT, 80);
  check('a plain rental splits 80/20', splitFor(at80(3000)).owner, 2400);
  check('and the business keeps the rest', splitFor(at80(3000)).operator, 600);

  group('The two sides always add back up');

  // The whole point of rounding one side and subtracting for the other.
  // 1667 at 80% is 1333.6 — rounding both independently gives 1334 + 333,
  // which is one peso more than came in.
  const odd = splitFor(at80(1667));
  check('an awkward amount still reconciles', odd.owner + odd.operator, 1667);
  check('the owner gets the rounded share', odd.owner, 1334);
  check('the business takes what is left', odd.operator, 333);

  const third = splitFor({ subtotal: 1000, ownerShare: { percent: 33 } });
  check('a third of a thousand reconciles too', third.owner + third.operator, 1000);
  check('rounded up from 330', third.owner, 330);

  for (const amount of [1, 7, 99, 333, 1667, 4999, 123456]) {
    const s = splitFor(at80(amount));
    check(`${amount} splits without inventing a peso`, s.owner + s.operator, amount);
  }

  group('The base is the rental, not everything collected');

  check(
    'delivery is not shared',
    splitFor(at80(2000, { deliveryFee: 500 })).base,
    2000,
  );
  check(
    'nor are late fees, fuel or damage',
    splitFor(at80(2000, { lateFee: { amount: 1500 }, fuel: { charge: 400 }, condition: { damageCharge: 9000 } })).base,
    2000,
  );
  check(
    'the owner is paid before the promo discount, not after',
    splitFor({ subtotal: 5000, totalPrice: 4000, discountAmount: 1000, ownerShare: { percent: 80 } }).owner,
    4000,
  );
  check(
    'a booking from before subtotals existed falls back to its total',
    rentalCreditedFor({ subtotal: 0, totalPrice: 2500 }),
    2500,
  );
  check('and a booking with neither is zero, not NaN', rentalCreditedFor({}), 0);

  group('Bookings made before any agreement');

  const old = { subtotal: 3000, totalPrice: 3000 };
  check('nothing was agreed', hasAgreedShare(old), false);
  check('so the owner keeps all of it', agreedPercent(old), 100);
  check('the whole rental', splitFor(old).owner, 3000);
  check('and the business took nothing', splitFor(old).operator, 0);
  check('an agreement of zero per cent is still an agreement',
    hasAgreedShare({ ownerShare: { percent: 0 } }), true);
  check('and means it', splitFor({ subtotal: 1000, ownerShare: { percent: 0 } }).owner, 0);

  group('Totals mix the rates they were agreed at');

  // The reason sumSplit adds booking by booking instead of taking a
  // percentage of the grand total: these two were made under different
  // terms, and one multiplication over the pair would be wrong for both.
  const mixed = sumSplit([at80(1000), { subtotal: 1000, totalPrice: 1000 }]);
  check('two thousand came in', mixed.base, 2000);
  check('the owner is owed 800 plus 1000', mixed.owner, 1800);
  check('and the business kept only the 200', mixed.operator, 200);
  check('across two bookings', mixed.count, 2);
  check('an empty list is zero, not NaN', sumSplit([]).base, 0);
  check('and sums still reconcile', mixed.owner + mixed.operator, mixed.base);

  group('What a discount costs us');

  // The user's own example: a 5,000 rental run at 2,500 on promo. The owner
  // is still paid on 5,000 because the promotion was not their idea.
  const half = afterDiscount({ rental: 5000, discount: 2500, percent: 80 });
  check('the owner is paid on the full price', half.owner, 4000);
  check('but only half of it came in', half.collected, 2500);
  check('so the promotion costs us 1,500', half.weKeep, -1500);

  // Our share IS the whole margin, so it is also the break-even point.
  check('a discount of exactly our share earns us nothing',
    afterDiscount({ rental: 5000, discount: 1000, percent: 80 }).weKeep, 0);
  check('a penny less and we are still ahead',
    afterDiscount({ rental: 5000, discount: 999, percent: 80 }).weKeep, 1);
  check('a penny more and we are paying for the trip',
    afterDiscount({ rental: 5000, discount: 1001, percent: 80 }).weKeep, -1);
  check('no discount leaves us our whole share',
    afterDiscount({ rental: 5000, discount: 0, percent: 80 }).weKeep, 1000);
  check('a wider share leaves more room before it hurts',
    afterDiscount({ rental: 5000, discount: 1400, percent: 70 }).weKeep, 100);
  check('a discount cannot exceed the rental',
    afterDiscount({ rental: 2000, discount: 9999, percent: 80 }).collected, 0);
  check('nonsense is zero, not NaN', afterDiscount({}).weKeep, 0);

  group('How deep a promo cuts');

  check('a percentage is the same at any length',
    worstCaseDiscount({ type: 'percent', value: 30 }, 1500), 450);
  // A fixed amount bites hardest on the shortest possible hire, which is
  // why the warning is worked out on one day.
  check('a fixed amount is worst on a one-day hire',
    worstCaseDiscount({ type: 'amount', value: 500 }, 1500), 500);
  check('and never takes more than the day itself',
    worstCaseDiscount({ type: 'amount', value: 9000 }, 1500), 1500);
  check('an over-100 percentage is clamped',
    worstCaseDiscount({ type: 'percent', value: 250 }, 1500), 1500);
  check('nothing typed yet is nothing off', worstCaseDiscount({ type: 'percent', value: '' }, 1500), 0);

  // The two together: this is the test the warning actually asks.
  const promoOn = (promo, day, pct) => afterDiscount({
    rental: day, discount: worstCaseDiscount(promo, day), percent: pct,
  }).weKeep;
  check('20% off at an 80/20 split breaks even',
    promoOn({ type: 'percent', value: 20 }, 1500, 80), 0);
  check('25% off costs us', promoOn({ type: 'percent', value: 25 }, 1500, 80) < 0, true);
  check('15% off still earns', promoOn({ type: 'percent', value: 15 }, 1500, 80) > 0, true);

  group('What admin is allowed to set');

  check('a whole number passes through', clampPercent(75), 75);
  check('halves are not a thing anybody agreed to', clampPercent(79.6), 80);
  check('over a hundred is clamped', clampPercent(140), 100);
  check('under zero is clamped', clampPercent(-10), 0);
  check('nonsense falls back to the default', clampPercent('abc'), 80);
  check('and an explicit fallback is honoured', clampPercent(undefined, 70), 70);

  check('no settings at all means the default', revenueShareSettings(null).ownerPercent, 80);
  check('an empty document too', revenueShareSettings({}).ownerPercent, 80);
  check('a saved value is used', revenueShareSettings({ revenueShare: { ownerPercent: 65 } }).ownerPercent, 65);
}
