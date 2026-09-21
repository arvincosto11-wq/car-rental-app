// Philippine time — the one place that decides what "7:00 AM" means.
//
// This file has no imports so the client keeps an identical copy
// (client/src/utils/phTime.js): the hour a client picks, the hour the server
// stores and the hour printed in an email all come from the same functions.
//
// Why this has to be explicit: a Date is an instant, not a wall clock. The
// server runs in UTC, the client's machine runs in whatever its owner set,
// and the business runs in Legazpi. Left to the default every one of those
// would read the same booking as a different hour — and 7:00 AM in Legazpi
// is 11:00 PM the previous day in UTC, so it shifts the DATE, not just the
// time. Everything here converts deliberately instead.
//
// The Philippines has no daylight saving (and has had none since 1978), so
// the offset is a constant rather than something that has to be looked up.

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

export const PH_OFFSET_HOURS = 8;
const OFFSET_MS = PH_OFFSET_HOURS * HOUR;

// Earliest and latest hour a vehicle is handed over. The return is always
// the same hour as the pickup, so this bounds both ends of every rental.
export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 20;

// Hours between one client's return and the next client's pickup. Covers
// cleaning and checking, and absorbs a late return so the next booking
// doesn't have to be moved. A vehicle can ask for more — see turnaroundHoursFor.
export const DEFAULT_TURNAROUND_HOURS = 2;

// A pickup less than this far away gets a warning (never a refusal — a
// booking still needs admin confirmation either way).
export const SHORT_NOTICE_HOURS = 2;

// Shifting by the offset lets the plain UTC getters read PH wall-clock
// parts. Deliberately not toLocaleString: that returns text to be parsed
// back, and parsing formatted dates is how timezone bugs get in.
const shifted = (d) => new Date(new Date(d).getTime() + OFFSET_MS);

// The calendar day an instant falls on in Legazpi, as YYYY-MM-DD.
export const phYmd = (d) => shifted(d).toISOString().slice(0, 10);

// The wall-clock hour in Legazpi, 0–23.
export const phHour = (d) => shifted(d).getUTCHours();

// The instant at which it is `hour` o'clock on `ymd` in Legazpi.
export const instantFrom = (ymd, hour = 0) => {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0, 0) - OFFSET_MS);
};

// Midnight in Legazpi on the day this instant falls on.
export const phDayStart = (d) => instantFrom(phYmd(d), 0);

// No daylight saving to step over, so days really are 24 hours apart.
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);

export const addHours = (d, n) => new Date(new Date(d).getTime() + n * HOUR);

// Whole days between two instants, which is what a rental is charged in.
export const daysBetween = (start, end) =>
  Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / DAY);

// Every hour a client may choose, earliest first.
export const pickupHours = () => {
  const hours = [];
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) hours.push(h);
  return hours;
};

export const isTradingHour = (hour) => Number.isInteger(hour) && hour >= OPEN_HOUR && hour <= CLOSE_HOUR;

// Any hour of the clock, for things that aren't customer pickups — a
// blocked range can start at 8:00 AM and end at noon. Checked before
// Number(), which would turn '' into a perfectly valid-looking midnight.
export const isClockHour = (hour) => hour !== '' && hour !== null && hour !== undefined
  && Number.isInteger(Number(hour)) && Number(hour) >= 0 && Number(hour) <= 23;

export const formatHour = (hour) => {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
};

const DATE_STYLE = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };

export const formatPhDate = (d, opts = DATE_STYLE) =>
  new Date(d).toLocaleDateString('en-US', { ...opts, timeZone: 'Asia/Manila' });

export const formatPhDateTime = (d) => `${formatPhDate(d)} · ${formatHour(phHour(d))}`;

// How a booking's pickup or return is written wherever anyone sees it.
// Bookings made before pickup times existed carry no hour, and must never
// be dressed up as a "12:00 AM" pickup they never had.
export const formatMoment = (d, hasTime, opts = DATE_STYLE) => (hasTime
  ? `${formatPhDate(d, opts)} · ${formatHour(phHour(d))}`
  : formatPhDate(d, opts));

// Bookings and blocked ranges saved before times existed sit at UTC
// midnight, which is 8:00 AM in Legazpi — eight hours adrift from the
// calendar day they were meant to mean. Snapping both ends back to the PH
// day they fall on restores the intent without migrating any data, and is
// harmless on ranges that are already aligned.
export const dayAlignedSpan = (start, end) => ({
  start: phDayStart(start),
  end: phDayStart(end),
});

// What a vehicle actually needs between customers. Blank on a vehicle means
// the standard two hours; a van can be given longer in Edit Car.
export const turnaroundHoursFor = (car) => {
  const raw = car?.turnaroundHours;
  // Checked before Number(), which turns null and '' into 0 — and 0 is a
  // legitimate override meaning "no gap needed", so it can't double as
  // "nothing set here". Getting this wrong would quietly remove the
  // turnaround from every vehicle that hadn't been given one.
  if (raw === null || raw === undefined || raw === '') return DEFAULT_TURNAROUND_HOURS;
  const own = Number(raw);
  return Number.isFinite(own) && own >= 0 ? own : DEFAULT_TURNAROUND_HOURS;
};

// The first moment the next client could collect this vehicle. Past closing
// it rolls to the following morning rather than offering a 10:00 PM pickup,
// which is why the buffer only really bites during the day.
export const earliestPickupAfter = (returnAt, hours = DEFAULT_TURNAROUND_HOURS) => {
  const at = addHours(returnAt, hours);
  const hour = phHour(at);
  if (hour < OPEN_HOUR) return instantFrom(phYmd(at), OPEN_HOUR);
  if (hour > CLOSE_HOUR) return instantFrom(phYmd(addDays(at, 1)), OPEN_HOUR);
  // Anything that lands mid-hour is pushed up to the next whole hour, since
  // those are the only times a client can pick.
  const exact = instantFrom(phYmd(at), hour);
  return exact.getTime() === at.getTime() ? at : instantFrom(phYmd(at), hour + 1);
};
