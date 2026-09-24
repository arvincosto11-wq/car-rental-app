import { suite, group, check } from './harness.mjs';
import { bookingSpan, blockedSpan, padded, overlaps, blockRanges } from '../utils/availability.js';
import { instantFrom, formatPhDateTime, turnaroundHoursFor } from '../utils/phTime.js';

const trip = (sd, sh, ed, eh) => ({ startDate: instantFrom(sd, sh), endDate: instantFrom(ed, eh), hasPickupTime: true });
const wants = (sd, sh, ed, eh) => ({ start: instantFrom(sd, sh), end: instantFrom(ed, eh) });

export default function run() {
  suite('Availability and the turnaround');

  // The booking everything else is measured against: collected 7:00 AM on
  // Sep 22, back 7:00 AM on Sep 27.
  const held = padded(bookingSpan(trip('2026-09-22', 7, '2026-09-27', 7)), 2);

  group('a 7am-to-7am booking holds the vehicle');
  check('from', formatPhDateTime(held.start), 'Tue, Sep 22, 2026 · 5:00 AM');
  check('until', formatPhDateTime(held.end), 'Sun, Sep 27, 2026 · 9:00 AM');

  group('the day it comes back is only part-taken');
  check('next client at 7:00 AM is too soon', overlaps(wants('2026-09-27', 7, '2026-09-28', 7), held), true);
  check('8:00 AM is still too soon', overlaps(wants('2026-09-27', 8, '2026-09-28', 8), held), true);
  check('9:00 AM is allowed', overlaps(wants('2026-09-27', 9, '2026-09-28', 9), held), false);
  check('10:00 AM is allowed', overlaps(wants('2026-09-27', 10, '2026-09-28', 10), held), false);

  group('and the gap is held on the other side too');
  // Either booking in a pair can be the one made second, so padding only
  // the earlier one would let a client return at the moment the next
  // collects.
  check('an earlier trip returning 7:00 AM Sep 22 clashes', overlaps(wants('2026-09-20', 7, '2026-09-22', 7), held), true);
  check('one returning 8:00 PM Sep 21 is fine', overlaps(wants('2026-09-20', 8, '2026-09-21', 20), held), false);

  group('a vehicle that needs longer');
  const van = padded(bookingSpan(trip('2026-09-22', 7, '2026-09-27', 7)), turnaroundHoursFor({ turnaroundHours: 4 }));
  check('10:00 AM is too soon', overlaps(wants('2026-09-27', 10, '2026-09-28', 10), van), true);
  check('11:00 AM is allowed', overlaps(wants('2026-09-27', 11, '2026-09-28', 11), van), false);

  group('a booking from before pickup times existed');
  const legacy = { startDate: new Date('2026-09-22T00:00:00Z'), endDate: new Date('2026-09-24T00:00:00Z'), hasPickupTime: false };
  const legacySpan = bookingSpan(legacy);
  check('occupies from', formatPhDateTime(legacySpan.start), 'Tue, Sep 22, 2026 · 12:00 AM');
  check('occupies until', formatPhDateTime(legacySpan.end), 'Thu, Sep 24, 2026 · 12:00 AM');
  const legacyHeld = padded(legacySpan, 2);
  check('a 7:00 AM pickup on the 22nd is refused', overlaps(wants('2026-09-22', 7, '2026-09-23', 7), legacyHeld), true);
  check('a 7:00 AM pickup on the 24th is allowed', overlaps(wants('2026-09-24', 7, '2026-09-25', 7), legacyHeld), false);
  check('a 7:00 AM pickup on the 21st is allowed', overlaps(wants('2026-09-20', 7, '2026-09-21', 7), legacyHeld), false);

  group('a blocked range saved from now on covers its last day');
  const fresh = { startDate: instantFrom('2026-09-22', 0), endDate: instantFrom('2026-09-24', 0), hasTime: false, endsInclusive: true };
  const f = blockedSpan(fresh);
  check('covers until', formatPhDateTime(f.end), 'Fri, Sep 25, 2026 · 12:00 AM');
  check('a pickup on the 22nd is refused', overlaps(wants('2026-09-22', 7, '2026-09-23', 7), f), true);
  check('a pickup on the 24th is refused', overlaps(wants('2026-09-24', 7, '2026-09-25', 7), f), true);
  check('a pickup on the 25th is allowed', overlaps(wants('2026-09-25', 7, '2026-09-26', 7), f), false);

  group('a blocked range saved before that keeps its own meaning');
  // Deliberately not migrated: two ranges live at the time would have grown
  // onto a day a confirmed booking already used.
  const old = { startDate: new Date('2026-09-22T00:00:00Z'), endDate: new Date('2026-09-24T00:00:00Z'), hasTime: false };
  const o = blockedSpan(old);
  check('covers until', formatPhDateTime(o.end), 'Thu, Sep 24, 2026 · 12:00 AM');
  check('a pickup on the 23rd is refused', overlaps(wants('2026-09-23', 7, '2026-09-24', 7), o), true);
  check('a pickup on the 24th is still allowed', overlaps(wants('2026-09-24', 7, '2026-09-25', 7), o), false);

  group('a half-day block: in the workshop 8:00 AM to noon');
  const half = blockedSpan({ startDate: instantFrom('2026-10-01', 8), endDate: instantFrom('2026-10-01', 12), hasTime: true });
  check('covers until', formatPhDateTime(half.end), 'Thu, Oct 1, 2026 · 12:00 PM');
  check('a 7:00 AM pickup that day is refused', overlaps(wants('2026-10-01', 7, '2026-10-02', 7), half), true);
  check('a 1:00 PM pickup that day is allowed', overlaps(wants('2026-10-01', 13, '2026-10-02', 13), half), false);
  check('a trip returning 8:00 AM that day is allowed', overlaps(wants('2026-09-30', 8, '2026-10-01', 8), half), false);

  group('a vehicle off the road is off it until somebody says otherwise');
  // A breakdown is a state, not a date range. On the day it happens nobody
  // knows how long the workshop will take, so guessing an end date either
  // frees the car too early or holds it longer than it needs holding.
  const roadworthy = { blockedDates: [] };
  const broken = { blockedDates: [], offRoad: { since: new Date('2026-09-25T10:00:00+08:00') } };

  check('a working vehicle blocks nothing', blockRanges(roadworthy).length, 0);
  check('a broken one blocks a span', blockRanges(broken).length, 1);
  check('and says why', blockRanges(broken)[0].kind, 'off-road');
  check('starting when it broke', blockRanges(broken)[0].start.getTime(), broken.offRoad.since.getTime());
  // Far enough ahead that nothing bookable falls past it — the point is that
  // no future date is free while the car is on a ramp.
  check('running well past anything bookable', blockRanges(broken)[0].end > new Date('2028-01-01'), true);
  // Cleared by hand, and then it is simply available again.
  check('cleared puts it back', blockRanges({ blockedDates: [], offRoad: { since: null } }).length, 0);
  // Existing blocked ranges still count alongside it.
  const both = { blockedDates: [{ status: 'approved', startDate: instantFrom('2026-10-01', 0), endDate: instantFrom('2026-10-03', 0), endsInclusive: true }], offRoad: { since: new Date('2026-09-25T10:00:00+08:00') } };
  check('a block and a breakdown both apply', blockRanges(both).length, 2);
}
