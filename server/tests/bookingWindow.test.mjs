import { suite, group, check } from './harness.mjs';
import {
  busySpansFrom, freeHoursFor, rangeIsBlocked, dayState,
  nextFreeSlot, nextFreeLabel, blockedFromMessage,
} from '../utils/bookingWindow.js';
import { instantFrom, pickupHours, turnaroundHoursFor, addHours } from '../utils/phTime.js';

// A booking out on the 21st, back at noon on the 24th, on a vehicle that
// needs the standard two hours. Shaped the way the server sends it: the
// turnaround is already inside busyStart/busyEnd.
const withTurnaround = (startYmd, startHour, endYmd, endHour, car = {}) => {
  const hours = turnaroundHoursFor(car);
  const start = instantFrom(startYmd, startHour);
  const end = instantFrom(endYmd, endHour);
  return {
    startDate: start,
    endDate: end,
    busyStart: addHours(start, -hours),
    busyEnd: addHours(end, hours),
  };
};

const ALL_HOURS = pickupHours().length;

export default function run() {
  suite('When a vehicle can go out');

  const ranges = [
    withTurnaround('2026-10-21', 8, '2026-10-24', 12),
    withTurnaround('2026-10-30', 15, '2026-11-02', 10),
  ];
  const spans = busySpansFrom(ranges);

  group('the server’s ranges arrive with the turnaround already in them');
  check('two spans', spans.length, 2);
  // Back at noon plus two hours: gone until 2 PM, not noon.
  check('the first ends at 2 PM, not noon', new Date(spans[0].end).toISOString().slice(11, 16), '06:00');
  check('and begins two hours before pickup', new Date(spans[0].start).toISOString().slice(11, 16), '22:00');

  group('a range with no busyStart is treated as whole days');
  // What the admin promo and blocked-date pickers send.
  const plain = busySpansFrom([{ startDate: '2026-10-21', endDate: '2026-10-24' }]);
  check('still produces a span', plain.length, 1);
  check('and it starts at midnight in Legazpi', new Date(plain[0].start).toISOString().slice(11, 16), '16:00');

  group('what each day has left');
  check('the day before pickup is gone too', dayState(spans, '2026-10-21').state, 'busy');
  check('mid-booking', dayState(spans, '2026-10-23').state, 'busy');
  check('the changeover day is part free', dayState(spans, '2026-10-24').state, 'part');
  check('and says from when', dayState(spans, '2026-10-24').label, 'available 2:00 PM onwards');
  check('with the hours to prove it', dayState(spans, '2026-10-24').free[0], 14);
  check('a clear day', dayState(spans, '2026-10-25').state, 'free');
  check('and it has every hour', dayState(spans, '2026-10-25').free.length, ALL_HOURS);

  group('the day a vehicle goes BACK out is part free the other way');
  // Out at 3 PM on the 30th, so gone from 1 PM once the turnaround is in.
  check('state', dayState(spans, '2026-10-30').state, 'part');
  // Gone from 1 PM, so the last hour anyone can collect it is noon.
  check('and says until when', dayState(spans, '2026-10-30').label, 'available until 12:00 PM');

  group('a trip needs every hour between its ends, not just the first');
  check('clear of everything', freeHoursFor(spans, '2026-10-25', '2026-10-28').length, ALL_HOURS);
  // Collecting on the 24th works, but only from 2 PM.
  check('starting on a changeover day', freeHoursFor(spans, '2026-10-24', '2026-10-26')[0], 14);
  // Back on the 30th: it has to be in before 1 PM, so only mornings work.
  check('returning on a changeover day', freeHoursFor(spans, '2026-10-25', '2026-10-30')[0], 7);
  check('and nothing later', freeHoursFor(spans, '2026-10-25', '2026-10-30').slice(-1)[0], 13);
  // This is the rule the old per-day check missed entirely.
  check('a trip straddling a booking has no hour at all', freeHoursFor(spans, '2026-10-29', '2026-10-31').length, 0);
  check('which makes the range blocked', rangeIsBlocked(spans, '2026-10-29', '2026-10-31'), true);
  check('a workable range is not', rangeIsBlocked(spans, '2026-10-25', '2026-10-28'), false);
  check('no dates is no hours', freeHoursFor(spans, '', '').length, 0);

  group('when nothing works, say what is in the way');
  check(
    'names the booking and which end to move',
    blockedFromMessage(spans, '2026-10-29', '2026-10-31'),
    'This vehicle is booked from Fri, Oct 30, 1:00 PM. Please pick an earlier return date.',
  );
  // The earliest clash is the one that limits the return date.
  check(
    'with two in the way it names the nearer one',
    blockedFromMessage(spans, '2026-10-20', '2026-11-05'),
    'This vehicle is booked from Wed, Oct 21, 6:00 AM. Please pick an earlier return date.',
  );
  check('nothing in the way falls back to the general answer',
    blockedFromMessage(spans, '2026-10-25', '2026-10-28').includes('other dates'), true);
  check('no dates, nothing to say', blockedFromMessage(spans, '', ''), '');

  group('when is it next free?');
  // Nine in the morning on the 23rd, mid-booking.
  const midBooking = instantFrom('2026-10-23', 9);
  check('the next slot', nextFreeSlot(spans, midBooking).ymd, '2026-10-24');
  check('at the hour the turnaround allows', nextFreeSlot(spans, midBooking).hour, 14);
  check('said plainly', nextFreeLabel(spans, midBooking), 'Sat, Oct 24 from 2:00 PM');

  group('hours already gone today are not offered');
  // Five in the afternoon on a completely free day.
  const lateAfternoon = instantFrom('2026-10-26', 17);
  check('same day, but later', nextFreeSlot([], lateAfternoon).ymd, '2026-10-26');
  check('the next hour, not 7 AM', nextFreeSlot([], lateAfternoon).hour, 18);
  // After closing there is nothing left today.
  const afterClosing = instantFrom('2026-10-26', 21);
  check('past closing it rolls to tomorrow', nextFreeSlot([], afterClosing).ymd, '2026-10-27');
  check('and opens at 7 AM', nextFreeSlot([], afterClosing).hour, 7);

  group('a vehicle with nothing free inside the horizon says so');
  const booked = busySpansFrom([withTurnaround('2026-10-20', 7, '2027-06-01', 18)]);
  check('no slot', nextFreeSlot(booked, instantFrom('2026-10-23', 9), 30), 'null');
  check('and no label to show', nextFreeLabel(booked, instantFrom('2026-10-23', 9), 30), '');

  group('a vehicle with an empty diary is free right now');
  check('today', nextFreeSlot([], instantFrom('2026-10-23', 6)).ymd, '2026-10-23');
  check('from opening', nextFreeSlot([], instantFrom('2026-10-23', 6)).hour, 7);
  check('every day is free', dayState([], '2026-10-23').state, 'free');

  group('a van given four hours loses more of the day');
  const van = busySpansFrom([withTurnaround('2026-10-21', 8, '2026-10-24', 12, { turnaroundHours: 4 })]);
  check('free from 4 PM, not 2', dayState(van, '2026-10-24').label, 'available 4:00 PM onwards');
  check('and the first workable hour follows', nextFreeSlot(van, instantFrom('2026-10-23', 9)).hour, 16);
}
