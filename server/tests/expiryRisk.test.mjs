// Which booking a lapsing registration spoils. Nothing in the live data
// has one today, so this is the only place the rule is exercised.

import { suite, group, check } from './harness.mjs';
import { riskFor, countAtRisk } from '../utils/expiryRisk.js';

export default function run() {
  suite('Admin · papers against bookings');

  const now = new Date('2026-10-15T04:00:00Z'); // 15 Oct, noon in Manila
  const car = (expiry) => ({ _id: 'c1', brand: 'Toyota', model: 'Vios', registrationExpiry: expiry });
  const trip = (start, end, over = {}) => ({
    _id: 'b1', status: 'confirmed', car: { _id: 'c1' },
    startDate: `${start}T23:00:00Z`, endDate: `${end}T23:00:00Z`, ...over,
  });

  group('papers that run out during a trip');
  // Papers good to the 31st, trip home on 2 November.
  const runsPast = riskFor(car('2026-10-31'), [trip('2026-10-28', '2026-11-01')], now);
  check('caught', runsPast.kind, 'runs_past');
  check('with the trip it belongs to', runsPast.start.slice(0, 10), '2026-10-28');

  // The papers are good for the whole of the day they expire.
  check('a trip ending on the expiry day is fine',
    riskFor(car('2026-10-31'), [trip('2026-10-29', '2026-10-30')], now), null);

  group('a trip beyond the expiry altogether');
  check('caught separately',
    riskFor(car('2026-10-31'), [trip('2026-11-02', '2026-11-04')], now).kind, 'starts_after');

  group('papers that have already lapsed');
  const lapsed = car('2026-10-13');
  check('a trip not yet collected',
    riskFor(lapsed, [trip('2026-10-17', '2026-10-19')], now).kind, 'before_pickup');
  // Already out with a client: nothing to stop at the counter any more.
  check('one already out is not this page’s problem',
    riskFor(lapsed, [trip('2026-10-12', '2026-10-18', { collectedAt: '2026-10-12T23:00:00Z' })], now), null);

  group('what is not at risk');
  check('a finished trip', riskFor(car('2026-10-31'), [trip('2026-09-01', '2026-09-03')], now), null);
  check('a booking nobody confirmed',
    riskFor(car('2026-10-31'), [trip('2026-10-28', '2026-11-01', { status: 'pending' })], now), null);
  check('a cancelled one',
    riskFor(car('2026-10-31'), [trip('2026-10-28', '2026-11-01', { status: 'cancelled' })], now), null);
  check('another vehicle’s booking',
    riskFor(car('2026-10-31'), [{ ...trip('2026-10-28', '2026-11-01'), car: { _id: 'other' } }], now), null);
  check('a vehicle with no expiry on file',
    riskFor({ _id: 'c1' }, [trip('2026-10-28', '2026-11-01')], now), null);

  group('the earliest one is the one reported');
  const two = riskFor(car('2026-10-31'), [
    trip('2026-11-10', '2026-11-12', { _id: 'later' }),
    trip('2026-10-28', '2026-11-01', { _id: 'sooner' }),
  ], now);
  check('the soonest trip', two.start.slice(0, 10), '2026-10-28');

  group('the count at the top of the page');
  check('counts only the ones with something', countAtRisk([null, { kind: 'runs_past' }, null, { kind: 'starts_after' }]), 2);
  check('none is none', countAtRisk([null, null]), 0);
}
