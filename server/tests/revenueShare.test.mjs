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
