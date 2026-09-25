import { suite, group, check } from './harness.mjs';
import { hasCollectedVehicle, extendBlocker } from '../utils/extendBooking.js';
import { instantFrom } from '../utils/phTime.js';
import { isOverdue, daysOverdue, daysLate, lateFeeFor, isDueSoon } from '../utils/overdueReturns.js';
import { occupiedSpan } from '../utils/availability.js';
import { fuelShortfall, fuelShortfallLabel, isFuelLevel, fuelLabel } from '../utils/fuel.js';
import { licenceProblem, idProblem } from '../utils/documents.js';
import { bookingPriority, byUrgency, TIER } from '../utils/priority.js';

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

  group('a vehicle that has not come back is still out');
  // It used to complete itself the day after the return date: the calendar
  // said the trip was over, so the trip was over. The client was asked to
  // rate a journey they were still on and the dates went back on sale while
  // the car sat in somebody's garage.
  const ended = {
    status: 'confirmed', hasPickupTime: true,
    startDate: instantFrom('2026-09-20', 7), endDate: instantFrom('2026-09-22', 7),
    collectedAt: instantFrom('2026-09-20', 7), returnedAt: null,
  };
  const now = new Date('2026-09-24T12:00:00+08:00');
  check('collected and never returned', isOverdue(ended, now), true);
  check('once it is back', isOverdue({ ...ended, returnedAt: now }, now), false);
  // Without a recorded handover there is nothing to say the car ever left,
  // so every booking made before pickups were tracked would read as missing.
  check('never recorded as picked up', isOverdue({ ...ended, collectedAt: null }, now), false);
  check('a trip still running', isOverdue({ ...ended, endDate: instantFrom('2026-09-30', 7) }, now), false);
  check('one already closed', isOverdue({ ...ended, status: 'completed' }, now), false);

  group('days late are counted from one');
  // An hour late and a day late are the same thing to whoever needs the car
  // tomorrow.
  check('an hour past the hour', daysOverdue(ended, new Date('2026-09-22T08:00:00+08:00')), 1);
  check('a full day and a bit', daysOverdue(ended, new Date('2026-09-23T08:00:00+08:00')), 2);

  group('the dates stay blocked until it is back');
  // The whole point: a second client must not be sold days on a vehicle
  // that is still out. The block grows with the delay rather than ending
  // where the booking said it would.
  check('the block runs to now, not to the return date', occupiedSpan(ended, now).end.getTime(), now.getTime());
  check('a returned booking keeps its own end', occupiedSpan({ ...ended, returnedAt: now }, now).end.getTime(), ended.endDate.getTime());
  check('so does one nobody collected', occupiedSpan({ ...ended, collectedAt: null }, now).end.getTime(), ended.endDate.getTime());
  check('and a trip still running is untouched', occupiedSpan({ ...ended, endDate: instantFrom('2026-09-30', 7) }, now).end.getTime(), instantFrom('2026-09-30', 7).getTime());

  group('what being late costs, out of the terms rather than out of the air');
  // Terms and Conditions, section 8: "one day's rental rate per day of
  // delay". It was written down, agreed to, and implemented nowhere — so
  // collecting it meant noticing, counting and multiplying by hand.
  const back = (at) => ({ ...ended, status: 'completed', returnedAt: at });
  const RATE = 2500;

  check('on time costs nothing', lateFeeFor(back(instantFrom('2026-09-22', 7)), RATE).amount, 0);
  check('early costs nothing', lateFeeFor(back(instantFrom('2026-09-21', 7)), RATE).amount, 0);
  // Part of a day is a day: the vehicle could not be let to anybody else
  // that morning either.
  check('an hour late is one day', lateFeeFor(back(new Date('2026-09-22T08:00:00+08:00')), RATE).days, 1);
  check('and costs one day', lateFeeFor(back(new Date('2026-09-22T08:00:00+08:00')), RATE).amount, 2500);
  check('exactly 24 hours is still one day', lateFeeFor(back(instantFrom('2026-09-23', 7)), RATE).days, 1);
  check('an hour past that is two', lateFeeFor(back(new Date('2026-09-23T08:00:00+08:00')), RATE).days, 2);
  check('three days at the daily rate', lateFeeFor(back(instantFrom('2026-09-25', 7)), RATE).amount, 7500);

  group('a fee is never invented from missing numbers');
  // A vehicle still out has no return time, and a car with no rate must not
  // silently become a free late return that reads as deliberate.
  check('never returned, nothing owed yet', lateFeeFor(ended, RATE).amount, 0);
  check('no rate on the vehicle', lateFeeFor(back(instantFrom('2026-09-25', 7)), undefined).amount, 0);
  check('but the days are still counted', lateFeeFor(back(instantFrom('2026-09-25', 7)), undefined).days, 3);
  check('and daysLate agrees with daysOverdue mid-delay', daysLate(ended, now), daysOverdue(ended, now));

  group('fuel is measured, never assumed');
  // Terms section 5: back at the level it went out at, or the difference is
  // charged. Both readings have to exist — a missing one is not evidence
  // of anything, and charging on it would invent a debt.
  const tank = (out, back) => ({ fuel: { atPickup: out, atReturn: back } });
  check('same level, nothing owed', fuelShortfall(tank(8, 8)), 0);
  check('returned fuller, still nothing', fuelShortfall(tank(4, 6)), 0);
  check('half a tank short', fuelShortfall(tank(8, 4)), 4);
  check('and said in tank terms', fuelShortfallLabel(tank(8, 4)), '2/4 of a tank');
  check('an eighth short', fuelShortfallLabel(tank(8, 7)), '1/8 of a tank');
  check('emptied completely', fuelShortfallLabel(tank(8, 0)), 'a full tank');
  check('never read at pickup', fuelShortfall(tank(null, 2)), 0);
  check('never read at return', fuelShortfall(tank(6, null)), 0);
  check('neither read', fuelShortfall({}), 0);

  group('a gauge reading is a whole eighth or it is nothing');
  // Empty is a real reading and must not be mistaken for a missing one,
  // which is why the check is on the value's shape rather than its truth.
  check('empty is a reading', isFuelLevel(0), true);
  check('full is a reading', isFuelLevel(8), true);
  check('over full is not', isFuelLevel(9), false);
  check('below empty is not', isFuelLevel(-1), false);
  check('half an eighth is not', isFuelLevel(3.5), false);
  check('nothing is not', isFuelLevel(null), false);
  check('and empty still reads as Empty', fuelLabel(0), 'Empty');

  group('papers have to outlast the booking, not just today');
  // The old check asked "is the licence valid now?", which let somebody book
  // a trip their licence expires halfway through and find out at the counter
  // — where nobody can renew anything.
  const today = new Date('2026-09-25T10:00:00+08:00');
  const driver = (expiry) => ({ licenseNumber: 'N02-19-004417', licenseExpiry: expiry });
  const trip = (endYmd) => ({ bookingType: 'self-drive', endDate: instantFrom(endYmd, 7) });

  check('valid past the return', licenceProblem(driver(instantFrom('2027-01-01', 7)), trip('2026-09-28'), today), null);
  check('expires mid-trip', licenceProblem(driver(instantFrom('2026-09-26', 7)), trip('2026-09-28'), today).kind, 'expires_during');
  check('already expired', licenceProblem(driver(instantFrom('2026-09-20', 7)), trip('2026-09-28'), today).kind, 'expired');
  check('none on file', licenceProblem({}, trip('2026-09-28'), today).kind, 'missing');
  // A licence is good for the whole of its expiry date, so one expiring on
  // the return day still covers the trip. Compared as Philippine calendar
  // days: a UTC comparison retires it eight hours early.
  check('expires on the return day itself', licenceProblem(driver(instantFrom('2026-09-28', 7)), trip('2026-09-28'), today), null);
  check('expires today, trip ends today', licenceProblem(driver(instantFrom('2026-09-25', 7)), trip('2026-09-25'), today), null);

  group("a driver's licence is only asked of the person driving");
  // With-driver bookings never ask. It is not their licence doing the work,
  // and refusing them over it would turn a rule about safety into paperwork.
  check('with-driver, no licence at all', licenceProblem({}, { bookingType: 'with-driver', endDate: instantFrom('2026-09-28', 7) }, today), null);
  check('with-driver, expired licence', licenceProblem(driver(instantFrom('2020-01-01', 7)), { bookingType: 'with-driver', endDate: instantFrom('2026-09-28', 7) }, today), null);

  group('an ID is warned about, never refused over');
  // The terms ask for two IDs at the counter, so one expiring on file is
  // something to raise rather than something to block a booking over. The
  // rule still has to spot it.
  check('outlasts the trip', idProblem({ validIdExpiry: instantFrom('2030-01-01', 7) }, { endDate: instantFrom('2026-09-28', 7) }, today), null);
  check('expires mid-trip', idProblem({ validIdExpiry: instantFrom('2026-09-26', 7) }, { endDate: instantFrom('2026-09-28', 7) }, today).kind, 'expires_during');
  check('none on file is not a problem here', idProblem({}, { endDate: instantFrom('2026-09-28', 7) }, today), null);

  group('the list runs from what is late to what is far off');
  // Both lists were sorted by when the booking was made, which answers a
  // question nobody asks. What matters is what needs doing next.
  const when = new Date('2026-09-25T12:00:00+08:00');
  const base = { status: 'confirmed', payment: 'paid', createdAt: new Date('2026-09-01T00:00:00Z') };
  const missing = { ...base, startDate: instantFrom('2026-09-20', 7), endDate: instantFrom('2026-09-23', 7), collectedAt: instantFrom('2026-09-20', 7), returnedAt: null };
  const waiting = { ...base, status: 'pending', startDate: instantFrom('2026-10-10', 7), endDate: instantFrom('2026-10-12', 7) };
  const soon = { ...base, startDate: instantFrom('2026-09-25', 17), endDate: instantFrom('2026-09-26', 17) };
  const later = { ...base, startDate: instantFrom('2026-11-01', 7), endDate: instantFrom('2026-11-03', 7) };
  const done = { ...base, status: 'completed', startDate: instantFrom('2026-09-01', 7), endDate: instantFrom('2026-09-02', 7), returnedAt: instantFrom('2026-09-02', 7) };

  check('a missing vehicle outranks everything', bookingPriority(missing, { now: when }).tier, TIER.MISSING);
  check('a pending booking is a decision', bookingPriority(waiting, { now: when }).tier, TIER.DECIDE);
  check('a trip today is merely scheduled', bookingPriority(soon, { now: when }).tier, TIER.SCHEDULED);
  check('and so is one in November', bookingPriority(later, { now: when }).tier, TIER.SCHEDULED);
  check('a finished one is done', bookingPriority(done, { now: when }).tier, TIER.DONE);

  // Kind outranks clock: a vehicle nobody has seen since Sunday comes above
  // a pickup at five, however close five is.
  const order = byUrgency([done, later, soon, waiting, missing], { now: when });
  check('missing first', order[0], missing);
  check('then the decision', order[1], waiting);
  check('then today', order[2], soon);
  check('then November', order[3], later);
  check('finished last', order[4], done);

  group('a client reads their own list by what they owe');
  // Not "what must I action" but "what is happening to me". An offer they
  // have to answer beats a trip they have only to turn up for.
  const offer = { ...base, startDate: instantFrom('2026-12-01', 7), endDate: instantFrom('2026-12-03', 7), adjustOffer: { status: 'open', deadline: new Date('2026-09-26T00:00:00Z') } };
  const unpaid = { ...base, payment: 'gcash_pending', startDate: instantFrom('2026-10-01', 7), endDate: instantFrom('2026-10-02', 7) };
  check('an offer with a deadline needs them', bookingPriority(offer, { role: 'client', now: when }).tier, TIER.DECIDE);
  check('so does an abandoned checkout', bookingPriority(unpaid, { role: 'client', now: when }).tier, TIER.DECIDE);
  check('a paid upcoming trip does not', bookingPriority(soon, { role: 'client', now: when }).tier, TIER.SCHEDULED);
  // Admin has nothing to do about an unpaid booking — they never see it.
  check('but admin is not asked to decide an unpaid one', bookingPriority(unpaid, { now: when }).tier, TIER.SCHEDULED);

  group('a word before the deadline, not only a bill after it');
  // Most late returns are somebody who lost track of the day. A reminder
  // costs nothing and is worth more than any fine.
  const running = {
    status: 'confirmed', hasPickupTime: true,
    startDate: instantFrom('2026-09-24', 17), endDate: instantFrom('2026-09-26', 17),
    collectedAt: instantFrom('2026-09-24', 17), returnedAt: null,
  };
  const noon25 = new Date('2026-09-25T12:00:00+08:00');
  check('due tomorrow morning, out now', isDueSoon({ ...running, endDate: instantFrom('2026-09-26', 7) }, noon25), true);
  // 5pm tomorrow is 29 hours away, which is outside the window on purpose.
  check('due tomorrow evening is not yet soon', isDueSoon(running, noon25), false);
  // A day and a half out is not yet worth a message; they would forget again.
  check('still two days off', isDueSoon({ ...running, endDate: instantFrom('2026-09-28', 17) }, noon25), false);
  // Once it is late the other sweep takes over, and being told to return it
  // "on time" would be absurd.
  check('already overdue is not due soon', isDueSoon({ ...running, endDate: instantFrom('2026-09-24', 17) }, noon25), false);
  check('never collected gets no reminder', isDueSoon({ ...running, collectedAt: null }, noon25), false);
  check('already back gets no reminder', isDueSoon({ ...running, returnedAt: noon25 }, noon25), false);
}
