import { suite, group, check } from './harness.mjs';
import {
  balanceDue, lateFeeSoFar, unsettledCharges, vehicleState, comparePeriods,
} from '../utils/adminToday.js';
import { phInstant } from '../utils/appointments.js';

export default function run() {
  suite('Admin dashboard · today');

  group('what is still to collect at the counter');
  // A deposit is 20% of the total, so the rest is due when the keys go over.
  check('a deposit booking owes the rest', balanceDue({ totalPrice: 2000, amountPaid: 400 }), 1600);
  check('paid in full owes nothing', balanceDue({ totalPrice: 2000, amountPaid: 2000 }), 0);
  // Never negative. An over-payment is somebody else's problem to explain,
  // not a negative number on the morning's list of money to collect.
  check('an over-payment is not a debt', balanceDue({ totalPrice: 2000, amountPaid: 2500 }), 0);
  check('nothing recorded reads as the whole price', balanceDue({ totalPrice: 1500 }), 1500);

  group('the late fee on a vehicle still out');
  const out = (over = {}) => ({
    status: 'confirmed',
    collectedAt: phInstant('2026-10-10', 7),
    returnedAt: null,
    endDate: phInstant('2026-10-12', 7),
    ...over,
  });
  const noon14 = phInstant('2026-10-14', 12);

  // One day's rental per day of delay — the terms' own unit, and the same
  // rule the counter charges on return.
  // Due back 7am on the 12th, asked at noon on the 14th: two days and five
  // hours, which is three days at a day's rent each.
  check('three days at ₱2,000 a day', lateFeeSoFar(out(), 2000, noon14), 6000);
  // Part of a day is a day: an hour late and a day late are the same thing
  // to whoever needed the car this morning.
  check('an hour over is a whole day', lateFeeSoFar(out({ endDate: phInstant('2026-10-14', 11) }), 2000, noon14), 2000);
  check('still inside its time owes nothing', lateFeeSoFar(out({ endDate: phInstant('2026-10-15', 7) }), 2000, noon14), 0);
  check('a vehicle already back owes nothing here', lateFeeSoFar(out({ returnedAt: phInstant('2026-10-13', 7) }), 2000, noon14), 0);
  check('never collected is not overdue', lateFeeSoFar(out({ collectedAt: null }), 2000, noon14), 0);
  // Lateness already settled by extending is carried, or extending would be
  // the cheapest way to dodge the fine.
  check('lateness paid for by extending is carried', lateFeeSoFar(out({ lateFee: { carriedAmount: 1000 } }), 2000, noon14), 7000);

  group('charges recorded but not taken in');
  const kinds = (b) => unsettledCharges(b).map((c) => c.kind).join(', ');
  check('a late fee nobody settled', kinds({ lateFee: { amount: 2000, collectedAt: null } }), 'Late fee');
  check('a settled one is gone', kinds({ lateFee: { amount: 2000, collectedAt: new Date() } }), '');
  check('fuel and damage stand on their own', kinds({
    fuel: { charge: 500, collectedAt: null },
    condition: { damageCharge: 1200, damageCollectedAt: null },
  }), 'Refuelling, Damage');
  // Each kind carries its own collectedAt, so settling one must not hide
  // the other on the same booking.
  check('settling the fuel leaves the damage', kinds({
    fuel: { charge: 500, collectedAt: new Date() },
    condition: { damageCharge: 1200, damageCollectedAt: null },
  }), 'Damage');
  check('a zero charge is not a debt', kinds({ fuel: { charge: 0, collectedAt: null } }), '');

  group('what each vehicle is doing');
  const outNow = new Set(['car-out']);
  const car = (over = {}) => ({ _id: 'car-free', isAvailable: true, ...over });
  const today = phInstant('2026-10-14', 9);
  check('free to book', vehicleState(car(), outNow, today), 'free');
  check('out on rent', vehicleState(car({ _id: 'car-out' }), outNow, today), 'out');
  check('hidden by the office', vehicleState(car({ isAvailable: false }), outNow, today), 'hidden');
  check('off the road', vehicleState(car({ offRoad: { since: today } }), outNow, today), 'offRoad');
  check('papers expired', vehicleState(car({ registrationExpiry: phInstant('2026-10-01', 0) }), outNow, today), 'expired');
  // One status each, in the order somebody acts on them: the papers have to
  // be put right before the repair matters.
  check('expired beats off the road', vehicleState(
    car({ registrationExpiry: phInstant('2026-10-01', 0), offRoad: { since: today } }), outNow, today,
  ), 'expired');
  check('off the road beats hidden', vehicleState(
    car({ offRoad: { since: today }, isAvailable: false }), outNow, today,
  ), 'offRoad');

  group('revenue against the period before');
  check('up by half', comparePeriods(1500, 1000), 50);
  check('down by two thirds', comparePeriods(1000, 3000), -67);
  // Nothing to compare against is not a 100% rise.
  check('no takings last time says nothing', comparePeriods(1000, 0), null);
}
