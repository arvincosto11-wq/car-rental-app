// When this vehicle can actually go out, and what to say when it can't.
//
// This file is copied verbatim between the server and the client (see
// client/src/utils/bookingWindow.js). It answers the availability questions
// the booking screens ask, and they were answered in three different places
// before: the booking form worked out which hours a trip could run from, the
// calendar worked out what state each day was in, and both of them
// normalised the server's busy ranges with their own copy of the same four
// lines.
//
// Two of the questions here had no implementation at all. "When is this
// vehicle next free?" was never asked, although the vehicle page wants it on
// the booking card. And when no hour works across a range, the form showed
// an empty list of times and left the client to guess why — this names the
// booking that is in the way instead.
//
// Nothing here adds a turnaround. The server sends each booking's span with
// the vehicle's own turnaround already inside it, so these functions must
// take the spans at face value or they would double it.

import {
  instantFrom, phDayStart, phYmd, phHour, pickupHours, formatHour, formatPhDate,
  addDays, CLOSE_HOUR,
} from './phTime.js';

const SHORT_DATE = { weekday: 'short', month: 'short', day: 'numeric' };

// What the server sends, as plain numbers.
//
// busyStart/busyEnd carry the turnaround and are what a real booking looks
// like. Ranges without them are whole calendar days in Legazpi — the admin
// promo and blocked-date pickers send that shape — and are snapped the same
// way the server snaps them.
export const busySpansFrom = (bookedRanges = []) => bookedRanges.map((r) => (r.busyStart && r.busyEnd
  ? { start: new Date(r.busyStart).getTime(), end: new Date(r.busyEnd).getTime() }
  : { start: phDayStart(r.startDate).getTime(), end: phDayStart(r.endDate).getTime() }));

// Is the vehicle ours for this single moment?
const freeAt = (spans, instant) => !spans.some((b) => instant >= b.start && instant < b.end);

// Every hour a WHOLE trip could run from. Checked across the entire range,
// not just the moment of pickup: a 9:00 AM start is no use if the vehicle is
// due out again before the client is meant to bring it back. Both ends use
// the same hour, which is what the booking form sends.
export const freeHoursFor = (spans, start, end) => (start && end
  ? pickupHours().filter((h) => {
    const from = instantFrom(start, h).getTime();
    const to = instantFrom(end, h).getTime();
    return !spans.some((b) => from < b.end && to > b.start);
  })
  : []);

// A range with no workable hour is a range that can't be booked.
export const rangeIsBlocked = (spans, start, end) => freeHoursFor(spans, start, end).length === 0;

// What a single day has left.
//
// A day is not simply free or booked: a vehicle coming back at 7:00 AM is
// free again from 9:00, and losing that whole day is real money. So every
// hour a client could choose is tested and the day reports which are open.
export const dayState = (spans, day) => {
  const ymd = typeof day === 'string' ? day : phYmd(day);
  const hours = pickupHours();
  const free = hours.filter((h) => freeAt(spans, instantFrom(ymd, h).getTime()));
  if (!free.length) return { state: 'busy', free };
  if (free.length === hours.length) return { state: 'free', free };
  const from = free[0];
  const until = free[free.length - 1];
  return {
    state: 'part',
    free,
    // "From" when the free hours run to closing — the usual changeover day —
    // and "until" when the vehicle goes back out partway through instead.
    label: until === CLOSE_HOUR
      ? `available ${formatHour(from)} onwards`
      : `available until ${formatHour(until)}`,
  };
};

// The first moment somebody could collect this vehicle, for the booking
// card. Walks forward a day at a time and only offers hours that have not
// already passed, so it never says 7:00 AM at nine in the morning.
//
// Returns null when there is nothing inside the horizon, which the caller
// should say plainly rather than showing a blank.
export const nextFreeSlot = (spans, now = new Date(), horizonDays = 90) => {
  for (let i = 0; i < horizonDays; i += 1) {
    const ymd = phYmd(addDays(now, i));
    const { state, free } = dayState(spans, ymd);
    if (state === 'busy') continue;
    const usable = free.filter((h) => instantFrom(ymd, h).getTime() > now.getTime());
    if (usable.length) return { ymd, hour: usable[0] };
  }
  return null;
};

// "Next free: Sat, Oct 24 from 2 PM", or the honest answer when there isn't
// one inside the horizon.
export const nextFreeLabel = (spans, now = new Date(), horizonDays = 90) => {
  const slot = nextFreeSlot(spans, now, horizonDays);
  if (!slot) return '';
  return `${formatPhDate(instantFrom(slot.ymd, slot.hour), SHORT_DATE)} from ${formatHour(slot.hour)}`;
};

// Why these dates don't work.
//
// Showing an empty list of pickup times is technically true and no use at
// all: the client can see that nothing is offered but not what to change.
// This names the booking that is in the way and says which end to move,
// which is the only thing they can act on.
//
// The earliest overlapping span wins, because that is the one that limits
// the return date — a later one only matters once this one is cleared.
export const blockedFromMessage = (spans, start, end) => {
  if (!start || !end) return '';
  const hours = pickupHours();
  const from = instantFrom(start, hours[0]).getTime();
  const to = instantFrom(end, hours[hours.length - 1]).getTime();

  const clashes = spans
    .filter((b) => b.start < to && b.end > from)
    .sort((a, b) => a.start - b.start);

  if (!clashes.length) {
    return 'No pickup time is free across these dates. Please try other dates.';
  }
  // The span already includes the turnaround, so its start is earlier than
  // the booking the client would recognise. Naming the span's own start is
  // still the honest answer to "from when is it gone", and it is the moment
  // this vehicle stops being available.
  const blocker = clashes[0];
  // phHour, not getHours: the server runs in UTC, where 2:00 PM in Legazpi
  // reads as six in the morning.
  return `This vehicle is booked from ${formatPhDate(blocker.start, SHORT_DATE)}, `
    + `${formatHour(phHour(blocker.start))}. Please pick an earlier return date.`;
};
