import { suite, group, check } from './harness.mjs';
import { hasCollectedVehicle, extendBlocker } from '../utils/extendBooking.js';
import { instantFrom } from '../utils/phTime.js';

// A confirmed booking whose pickup hour has already gone by.
const pickupWasThisMorning = {
  startDate: instantFrom('2026-09-23', 7),
  endDate: instantFrom('2026-09-25', 7),
  hasPickupTime: true,
  collectedAt: null,
};

export default function run() {
  suite('Handover');

  group('having the vehicle is something somebody recorded, not the time of day');
  // The bug this replaced: "the pickup hour has passed, so they must have
  // it". A client running an hour late was counted as out on the road, and
  // extending then priced their trip as underway — extra days at the
  // standard rate — instead of repricing it whole with the long-rental
  // discount those extra days had earned them. Being late cost them money.
  check('an hour late is not collected', hasCollectedVehicle(pickupWasThisMorning), false);
  check('never turned up at all is not collected', hasCollectedVehicle({ ...pickupWasThisMorning, startDate: instantFrom('2026-09-20', 7) }), false);
  check('once the keys are handed over', hasCollectedVehicle({ ...pickupWasThisMorning, collectedAt: new Date('2026-09-23T08:15:00+08:00') }), true);

  group('a booking that predates the record still reads correctly');
  // utils/backfillCollected.js stamps these with their own pickup time, so
  // everything already underway when this shipped keeps the answer the old
  // rule gave it rather than silently becoming "never collected".
  check('backfilled to its pickup time', hasCollectedVehicle({ ...pickupWasThisMorning, collectedAt: pickupWasThisMorning.startDate }), true);

  group('nothing is collected before it exists');
  check('no record and no dates', hasCollectedVehicle({}), false);
  check('a booking still weeks away', hasCollectedVehicle({ startDate: instantFrom('2026-12-01', 7), collectedAt: null }), false);

  group('a booking that closed while the client was paying takes nothing more');
  // Admin can complete or cancel a trip at any moment, and none of that
  // reaches somebody standing at a GCash page. The rule that let them start
  // has to be asked again when they come back — otherwise the money lands
  // and the extra days get added to a trip that is already over.
  const live = {
    status: 'confirmed', payment: 'paid', refundStatus: 'none',
    startDate: instantFrom('2026-09-22', 7), endDate: instantFrom('2026-09-30', 7), hasPickupTime: true,
  };
  const at = new Date('2026-09-24T12:00:00+08:00');
  check('a running trip can still be extended', extendBlocker(live, at), null);
  check('one marked returned cannot', !!extendBlocker({ ...live, status: 'completed' }, at), true);
  check('a cancelled one cannot', !!extendBlocker({ ...live, status: 'cancelled' }, at), true);
  check('nor one with a refund in progress', !!extendBlocker({ ...live, refundStatus: 'requested' }, at), true);
  check('nor one that has already ended', !!extendBlocker({ ...live, endDate: instantFrom('2026-09-23', 7) }, at), true);
}
