// What the Analytics page counts. Every figure on that page is read by
// somebody deciding where the money went, so the counting is tested here
// rather than trusted to the drawing of it.

import { suite, group, check } from './harness.mjs';
import {
  rangeFor, inRange, moneyOverTime, weekKey, extraCharges, cancellations,
  vehicleStates, vehicleEarnings, idleReason, demand, clients, operations,
} from '../utils/analytics.js';

export default function run() {
  suite('Admin · analytics');

  // Mid-October, Philippine time.
  const now = new Date('2026-10-15T04:00:00Z');
  const all = rangeFor('all', now);
  const thisMonth = rangeFor('month', now);
  const lastMonth = rangeFor('last', now);

  const booking = (over = {}) => ({
    _id: 'b', status: 'completed', createdAt: '2026-10-01T02:00:00Z',
    startDate: '2026-10-05T23:00:00Z', endDate: '2026-10-06T23:00:00Z',
    totalDays: 1, totalPrice: 2000, amountPaid: 2000,
    car: { _id: 'c1', brand: 'Toyota', model: 'Vios' },
    user: { _id: 'u1', name: 'John', ratingCount: 0, avgRating: 0 },
    ...over,
  });

  group('the range every panel obeys');
  check('this month starts on the 1st', rangeFor('month', now).start.toISOString(), '2026-09-30T16:00:00.000Z');
  check('last month starts a month before that', lastMonth.start.toISOString(), '2026-08-31T16:00:00.000Z');
  check('and ends where this month begins', lastMonth.end.toISOString(), '2026-09-30T16:00:00.000Z');
  check('all time has no floor', all.start, null);
  check('a day inside counts', inRange('2026-10-05T23:00:00Z', thisMonth), true);
  check('a day before does not', inRange('2026-09-20T23:00:00Z', thisMonth), false);
  check('nothing has no date', inRange(null, thisMonth), false);
  // The end is the moment after the last day, so today's own bookings count.
  check('today still counts', inRange(now, thisMonth), true);

  group('money over time');
  const paidUp = booking();
  const halfPaid = booking({ _id: 'b2', amountPaid: 400 });
  const cancelled = booking({ _id: 'b3', status: 'cancelled', amountPaid: 0 });
  const money = moneyOverTime([paidUp, halfPaid, cancelled], thisMonth);
  check('cancelled earns nothing', money.revenue, 4000);
  check('what is still to come in', money.due, 1600);
  check('and what is already in', money.collected, 2400);
  check('a month in weeks', money.byWeek, true);
  check('both trips sit in the same week', money.columns.length, 1);
  check('weeks are the 1st to 7th', weekKey('2026-10-07'), '2026-10-w1');
  check('then the 8th to 14th', weekKey('2026-10-08'), '2026-10-w2');
  // Counted by pickup, not by when it was booked: a booking taken in
  // September for an October trip is October's earnings.
  const bookedEarly = booking({ _id: 'b4', createdAt: '2026-09-02T02:00:00Z' });
  check('counted by the day it goes out', moneyOverTime([bookedEarly], thisMonth).revenue, 2000);
  check('and not by the day it was booked', moneyOverTime([bookedEarly], lastMonth).revenue, 0);

  group('charges on top of the rental');
  const withCharges = booking({
    lateFee: { days: 1, amount: 2000, collectedAt: '2026-10-07T02:00:00Z' },
    fuel: { charge: 500 },
    condition: { damageCharge: 1500, damageCollectedAt: null },
  });
  const ex = extraCharges([withCharges], thisMonth);
  check('everything charged', ex.total, 4000);
  check('what has been paid', ex.settled, 2000);
  check('what has not', ex.unsettled, 2000);
  // One kind being paid must not mark another as paid.
  check('fuel on its own', ex.rows.find((r) => r.key === 'fuel').unsettled, 500);
  check('damage on its own', ex.rows.find((r) => r.key === 'damage').unsettled, 1500);
  check('a kind with nothing charged is still listed', ex.rows.length, 3);

  group('bookings that fell through');
  const fell = cancellations([
    booking(),
    booking({ _id: 'x1', status: 'cancelled', amountPaid: 400, refundStatus: 'approved' }),
    booking({ _id: 'x2', status: 'cancelled', amountPaid: 400, refundStatus: 'none' }),
    booking({ _id: 'x3', status: 'cancelled', amountPaid: 0, refundStatus: 'none' }),
  ], thisMonth);
  check('every booking made', fell.made, 4);
  check('the ones that stood', fell.kept, 1);
  check('the ones that did not', fell.cancelled, 3);
  check('money given back', fell.refunded, 1);
  check('money kept', fell.notRefunded, 1);
  // A booking nobody paid for cannot be money kept.
  check('nothing to give back', fell.nothingPaid, 1);
  // Counted by the day it was taken, so a booking made in September and
  // called off in October belongs to September.
  const madeInSeptember = booking({ _id: 'x4', status: 'cancelled', createdAt: '2026-09-10T02:00:00Z' });
  check('counted where it was taken', cancellations([madeInSeptember], lastMonth).cancelled, 1);
  check('and not where it died', cancellations([madeInSeptember], thisMonth).cancelled, 0);

  group('what state the vehicles are in');
  const cars = [
    { _id: 'c1', brand: 'Toyota', model: 'Vios' },
    { _id: 'c2', brand: 'Honda', model: 'Civic', isAvailable: false },
    { _id: 'c3', brand: 'BMW', model: 'X5', offRoad: { since: '2026-10-01T00:00:00Z' } },
    { _id: 'c4', brand: 'Toyota', model: 'Wigo', registrationExpiry: '2026-09-01T00:00:00Z' },
  ];
  const outNow = booking({ _id: 'o1', status: 'confirmed', collectedAt: '2026-10-14T02:00:00Z', returnedAt: null });
  const states = vehicleStates(cars, [outNow], now);
  check('out with a client', states.out, ['Toyota Vios']);
  check('free to book', states.free.length, 0);
  check('not listed', states.unlisted, ['Honda Civic']);
  check('off the road', states.offRoad, ['BMW X5']);
  check('papers expired', states.expired, ['Toyota Wigo']);
  // Expired papers beat an unlisted switch: the first is why it cannot go
  // out at all, the second is only how it is shown.
  check('expired outranks unlisted',
    vehicleStates([{ _id: 'c5', brand: 'A', model: 'B', isAvailable: false, registrationExpiry: '2026-01-01' }], [], now).expired.length, 1);
  check('nothing is counted twice', states.out.length + states.free.length + states.unlisted.length
    + states.offRoad.length + states.expired.length, cars.length);

  group('which vehicles earn, and which sit');
  const earn = vehicleEarnings(
    [{ _id: 'c1', brand: 'Toyota', model: 'Vios' }, { _id: 'c2', brand: 'Honda', model: 'Civic', isAvailable: false }],
    [booking({ totalPrice: 3000 })],
    thisMonth,
    now,
  );
  const vios = earn.rows.find((r) => r.name === 'Toyota Vios');
  const civic = earn.rows.find((r) => r.name === 'Honda Civic');
  check('the one that worked', vios.earned, 3000);
  check('one trip', vios.trips, 1);
  check('a day out', vios.daysOut, 1);
  check('the one that did not', civic.earned, 0);
  check('and why', civic.reason, 'Not listed');
  check('counted as idle', earn.idle, 1);
  check('the rest earned', earn.earning, 1);
  // Unlisting leaves no date behind, so the footnote has to say how many
  // vehicles the assumption covers.
  check('the assumption is counted', earn.assumed, 1);
  // A trip that runs past the edge of the range is cut at the edge.
  const straddling = booking({ startDate: '2026-09-28T23:00:00Z', endDate: '2026-10-03T23:00:00Z', totalDays: 5 });
  const cut = vehicleEarnings([{ _id: 'c1', brand: 'Toyota', model: 'Vios' }], [straddling], thisMonth, now);
  check('only the days inside count', cut.rows[0].daysOut, 3);
  check('a vehicle off the road loses those days',
    vehicleEarnings([{ _id: 'c3', brand: 'B', model: 'X5', offRoad: { since: '2026-10-08T00:00:00Z' } }], [], thisMonth, now).rows[0].daysAvailable, 7);
  check('an idle reason only when idle', idleReason({ offRoad: { since: '2026-10-01' } }, now), 'Off the road');
  check('listed and simply unbooked', idleReason({}, now), 'Listed, no bookings');

  group('when people book, how early, for how long');
  const d = demand([
    booking({ createdAt: '2026-10-05T02:00:00Z' }),
    booking({ _id: 'd2', createdAt: '2026-09-20T02:00:00Z', totalDays: 8 }),
  ], thisMonth, 7);
  // The fixture goes out at 7am Manila on Tuesday 6 October.
  check('both pickups on the same weekday', d.byDay[2], 2);
  check('one booked the day before', d.byLead[1], 1);
  check('one booked sixteen days ahead', d.byLead[4], 1);
  // Booked and collected on the same Philippine day.
  check('booked on the day itself',
    demand([booking({ createdAt: '2026-10-05T23:30:00Z' })], thisMonth).byLead[0], 1);
  check('a one-day trip', d.byTrip[0], 1);
  check('an eight-day trip', d.byTrip[3], 1);
  check('long enough for the discount', d.long, 1);
  // The weekday is read in Philippine time. This pickup is 7am Manila on
  // Monday the 5th, which is Sunday night in UTC.
  // 7am Manila on Monday the 5th is Sunday night in UTC, and would land on
  // the wrong bar if the date were read as the machine sees it.
  check('the weekday is the local one', demand([booking({ startDate: '2026-10-04T23:00:00Z' })], thisMonth).byDay[1], 1);

  group('who comes back');
  const twice = { _id: 'u2', name: 'Repeat', ratingCount: 2, avgRating: 4.6 };
  const once = { _id: 'u3', name: 'New', ratingCount: 0, avgRating: 0 };
  const who = clients([
    booking({ _id: 'c-a', user: twice, startDate: '2026-10-02T23:00:00Z' }),
    booking({ _id: 'c-b', user: twice, startDate: '2026-08-02T23:00:00Z' }),
    booking({ _id: 'c-c', user: once }),
  ], thisMonth);
  check('people who booked in this range', who.booked, 2);
  check('one of them had been before', who.returning, 1);
  check('and one was new', who.first, 1);
  check('a five-star client', who.stars[0], 1);
  check('nobody rated yet', who.unrated, 1);

  group('what costs a day of rental');
  const ops = operations([
    booking({ lateFee: { days: 2, amount: 4000 } }),
    booking({ _id: 'e1', extensions: [{ days: 1 }] }),
    booking({ _id: 'o2', status: 'confirmed', collectedAt: '2026-10-10T02:00:00Z', endDate: '2026-10-12T23:00:00Z' }),
    booking({ _id: 'dr', driver: 'd1', deliveryFee: 300 }),
  ], thisMonth, now);
  check('late returns', ops.late, 1);
  check('what the lateness earned', ops.lateFees, 4000);
  check('extensions', ops.extensions, 1);
  check('still not back', ops.overdue, 1);
  check('went out with a driver', ops.withDriver, 1);
  check('and was delivered', ops.delivered, 1);
}
