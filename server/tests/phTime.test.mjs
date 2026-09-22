import { suite, group, check } from './harness.mjs';
import {
  instantFrom, phYmd, phHour, phDayStart, dayAlignedSpan, daysBetween,
  formatPhDateTime, formatMoment, formatHour, pickupHours, isTradingHour,
  isClockHour, turnaroundHoursFor, earliestPickupAfter,
} from '../utils/phTime.js';

export default function run() {
  suite('Philippine time');

  group('a 7:00 AM pickup in Legazpi is the night before in UTC');
  const seven = instantFrom('2026-09-22', 7);
  check('stored instant', seven.toISOString(), '2026-09-21T23:00:00.000Z');
  check('reads back as the 22nd', phYmd(seven), '2026-09-22');
  check('reads back as 7 o\'clock', phHour(seven), 7);
  check('printed', formatPhDateTime(seven), 'Tue, Sep 22, 2026 · 7:00 AM');

  const eight = instantFrom('2026-09-22', 20);
  check('an 8:00 PM pickup stores as', eight.toISOString(), '2026-09-22T12:00:00.000Z');
  check('and reads back as', formatPhDateTime(eight), 'Tue, Sep 22, 2026 · 8:00 PM');

  group('bookings saved before pickup times existed');
  const legacy = new Date('2026-09-22T00:00:00.000Z');
  check('UTC midnight is really 8:00 AM here', phHour(legacy), 8);
  check('but its calendar day is still the 22nd', phYmd(legacy), '2026-09-22');
  const span = dayAlignedSpan(legacy, new Date('2026-09-24T00:00:00.000Z'));
  check('snapped start', formatPhDateTime(span.start), 'Tue, Sep 22, 2026 · 12:00 AM');
  check('snapped end', formatPhDateTime(span.end), 'Thu, Sep 24, 2026 · 12:00 AM');
  check('snapping twice changes nothing', phDayStart(span.start).toISOString(), span.start.toISOString());
  check('and they are never shown a time', formatMoment(legacy, false), 'Tue, Sep 22, 2026');
  check('while a real one is', formatMoment(seven, true), 'Tue, Sep 22, 2026 · 7:00 AM');

  group('the turnaround between customers');
  check('returned 7:00 AM, next pickup', formatPhDateTime(earliestPickupAfter(instantFrom('2026-09-27', 7), 2)), 'Sun, Sep 27, 2026 · 9:00 AM');
  check('returned 6:00 PM, same evening', formatPhDateTime(earliestPickupAfter(instantFrom('2026-09-27', 18), 2)), 'Sun, Sep 27, 2026 · 8:00 PM');
  check('returned 7:00 PM, rolls to the morning', formatPhDateTime(earliestPickupAfter(instantFrom('2026-09-27', 19), 2)), 'Mon, Sep 28, 2026 · 7:00 AM');
  check('a legacy midnight end opens at 7:00 AM', formatPhDateTime(earliestPickupAfter(instantFrom('2026-09-27', 0), 2)), 'Sun, Sep 27, 2026 · 7:00 AM');
  check('a van given 4 hours', formatPhDateTime(earliestPickupAfter(instantFrom('2026-09-27', 7), 4)), 'Sun, Sep 27, 2026 · 11:00 AM');

  group('a blank per-vehicle turnaround means the standard two hours');
  // Number(null) is 0, and 0 is a legitimate override meaning "no gap
  // needed" — so blank cannot be allowed to read as zero, or every vehicle
  // without an override silently loses its turnaround.
  check('nothing set', turnaroundHoursFor({}), 2);
  check('explicitly null', turnaroundHoursFor({ turnaroundHours: null }), 2);
  check('an empty box', turnaroundHoursFor({ turnaroundHours: '' }), 2);
  check('nonsense', turnaroundHoursFor({ turnaroundHours: 'soon' }), 2);
  check('a van set to 4', turnaroundHoursFor({ turnaroundHours: 4 }), 4);
  check('zero is honoured, not treated as blank', turnaroundHoursFor({ turnaroundHours: 0 }), 0);

  group('a day is still exactly a day, whatever the hour');
  check('7:00 AM to 7:00 AM, a week later', daysBetween(instantFrom('2026-09-22', 7), instantFrom('2026-09-29', 7)), 7);
  check('8:00 PM to 8:00 PM, next day', daysBetween(instantFrom('2026-09-22', 20), instantFrom('2026-09-23', 20)), 1);
  check('a legacy midnight-to-midnight week', daysBetween(new Date('2026-09-22T00:00:00Z'), new Date('2026-09-29T00:00:00Z')), 7);

  group('changing the hour never changes the trip length');
  // This is what makes the pickup time safe to move on a reschedule or when
  // a bumped client picks their own dates. The price is held still by the
  // LENGTH, so if any hour could produce a different day count, moving the
  // time would quietly reprice the booking.
  let lengthHeld = true;
  for (const h of pickupHours()) {
    for (const nights of [1, 3, 7, 30]) {
      const from = instantFrom('2026-09-22', h);
      const to = instantFrom(phYmd(new Date(from.getTime() + nights * 24 * 60 * 60 * 1000)), h);
      if (daysBetween(from, to) !== nights) lengthHeld = false;
    }
  }
  check('every hour, over 1, 3, 7 and 30 days', lengthHeld, true);
  check('7:00 AM start, 3 days', daysBetween(instantFrom('2026-09-22', 7), instantFrom('2026-09-25', 7)), 3);
  check('the same trip started at 8:00 PM', daysBetween(instantFrom('2026-09-22', 20), instantFrom('2026-09-25', 20)), 3);

  group('the hours a client may choose');
  check('earliest', pickupHours()[0], 7);
  check('latest', pickupHours()[pickupHours().length - 1], 20);
  check('how many', pickupHours().length, 14);
  check('6:00 AM refused', isTradingHour(6), false);
  check('9:00 PM refused', isTradingHour(21), false);
  check('noon reads right', formatHour(12), '12:00 PM');
  check('midnight reads right', formatHour(0), '12:00 AM');

  group('any hour of the clock, for blocked ranges');
  check('midnight allowed', isClockHour(0), true);
  check('11:00 PM allowed', isClockHour(23), true);
  check('24 refused', isClockHour(24), false);
  // '' must not slip through as midnight — it is how the form says
  // "whole day", and reading it as 0 would make every block start at
  // midnight and claim to have been given times.
  check('an empty box is not midnight', isClockHour(''), false);
  check('null is not midnight', isClockHour(null), false);
}
