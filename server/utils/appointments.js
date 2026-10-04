// When somebody can come in with a vehicle.
//
// A consigned vehicle is no longer judged from photographs. The owner books
// a time, brings the vehicle and its papers, and somebody looks at all three
// together — the plate against the CR, the CR against the person holding it.
// That is a better check than any upload, and it needs a calendar.
//
// Slots are generated rather than stored. Admin says which days they are
// open and between which hours; the list of free times is worked out from
// that plus whatever is already booked. Storing every slot would mean
// writing a month of empty rows and rewriting them whenever the opening
// hours changed.
//
// One vehicle per slot, deliberately. This is an inspection, not a form to
// sign — two people at ten o'clock means one of them waiting in the car park
// while the other has their chassis number checked.
//
// Philippine time throughout. A slot is a wall-clock time at a real place
// somebody has to drive to, so "9 AM" has to mean nine in the morning in
// Camalig whatever the server thinks the date is.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/appointments.js). The times offered on the booking page
// and the times the server will accept have to be the same list.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PH_OFFSET_MS = 8 * HOUR_MS;

export const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export const APPOINTMENT_DEFAULTS = {
  enabled: true,
  // Monday to Saturday. A vehicle inspection is a working-day job.
  days: [1, 2, 3, 4, 5, 6],
  startHour: 9,
  endHour: 16,
  slotMinutes: 60,
  // Nobody can book this afternoon. Somebody has to be free to meet them,
  // and the vehicle has to be driven over.
  leadHours: 24,
  // How far out the calendar goes. Beyond a month, plans change and the
  // slot sits reserved for somebody who has forgotten about it.
  horizonDays: 30,
};

const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

// Fills in whatever the settings document is missing, and keeps the hours in
// an order that can actually produce a slot.
export function appointmentSettings(saved) {
  const a = saved?.appointments || saved || {};
  const days = Array.isArray(a.days) && a.days.length
    ? [...new Set(a.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : APPOINTMENT_DEFAULTS.days;
  const startHour = Math.min(23, Math.max(0, num(a.startHour, APPOINTMENT_DEFAULTS.startHour)));
  // An end before the start would generate nothing and look like a bug in
  // the booking page rather than a setting somebody typed backwards.
  const endHour = Math.min(24, Math.max(startHour + 1, num(a.endHour, APPOINTMENT_DEFAULTS.endHour)));
  return {
    enabled: a.enabled !== false,
    days: days.length ? days : APPOINTMENT_DEFAULTS.days,
    startHour,
    endHour,
    slotMinutes: Math.min(240, Math.max(15, num(a.slotMinutes, APPOINTMENT_DEFAULTS.slotMinutes))),
    leadHours: Math.max(0, num(a.leadHours, APPOINTMENT_DEFAULTS.leadHours)),
    horizonDays: Math.min(180, Math.max(1, num(a.horizonDays, APPOINTMENT_DEFAULTS.horizonDays))),
  };
}

// The PH calendar day an instant falls on, as YYYY-MM-DD.
export const phDay = (d) => new Date(new Date(d).getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);

// Which day of the week that is in Legazpi, 0–6.
export const phWeekday = (d) => new Date(new Date(d).getTime() + PH_OFFSET_MS).getUTCDay();

// A wall-clock time in Legazpi, as a real instant.
export function phInstant(ymd, hour, minute = 0) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - PH_OFFSET_MS);
}

// "9:00 AM" — the way it is written on a door, not a 24-hour clock.
export function slotLabel(instant) {
  const shifted = new Date(new Date(instant).getTime() + PH_OFFSET_MS);
  const h24 = shifted.getUTCHours();
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0');
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minute} ${suffix}`;
}

// Every slot that could exist between two dates, open or not.
function allSlots(settings, fromDay, days) {
  const s = appointmentSettings(settings);
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const dayStart = new Date(phInstant(fromDay, 0).getTime() + i * DAY_MS);
    const ymd = phDay(dayStart);
    if (!s.days.includes(phWeekday(dayStart))) continue;
    for (let minutes = s.startHour * 60; minutes + s.slotMinutes <= s.endHour * 60; minutes += s.slotMinutes) {
      out.push(phInstant(ymd, Math.floor(minutes / 60), minutes % 60));
    }
  }
  return out;
}

// The times somebody can actually pick.
//
//   taken   instants already booked, in any form a Date accepts
//
// Returns one entry per open slot: the instant, its PH day, and how to
// write it. Grouped by the caller, because a calendar and a list want the
// same data arranged differently.
export function openSlots(settings, { taken = [], now = new Date() } = {}) {
  const s = appointmentSettings(settings);
  if (!s.enabled) return [];
  const takenAt = new Set(taken.map((t) => new Date(t).getTime()));
  const earliest = new Date(now).getTime() + s.leadHours * HOUR_MS;

  return allSlots(s, phDay(now), s.horizonDays)
    .filter((slot) => slot.getTime() >= earliest && !takenAt.has(slot.getTime()))
    .map((slot) => ({ at: slot, day: phDay(slot), label: slotLabel(slot) }));
}

// Why this particular time cannot be booked, or null. The booking page
// filters the list, so reaching this means either a stale page or somebody
// posting straight at the API.
export function slotProblem(wanted, settings, { taken = [], now = new Date() } = {}) {
  const s = appointmentSettings(settings);
  if (!s.enabled) return 'We are not taking appointments at the moment.';
  const at = new Date(wanted);
  if (Number.isNaN(at.getTime())) return 'Please choose a time.';
  if (at.getTime() < new Date(now).getTime() + s.leadHours * HOUR_MS) {
    return s.leadHours >= 24
      ? `Please pick a time at least ${Math.round(s.leadHours / 24)} day${s.leadHours >= 48 ? 's' : ''} from now.`
      : 'That time has passed. Please pick another.';
  }
  if (at.getTime() > new Date(now).getTime() + s.horizonDays * DAY_MS) {
    return `We only take bookings ${s.horizonDays} days ahead. Please pick a nearer date.`;
  }
  if (taken.some((t) => new Date(t).getTime() === at.getTime())) {
    return 'Somebody has just taken that time. Please pick another.';
  }
  const fits = allSlots(s, phDay(at), 1).some((slot) => slot.getTime() === at.getTime());
  if (!fits) return 'We are not open then. Please pick one of the times offered.';
  return null;
}

// Whether what somebody typed about the vehicle is worth writing down.
//
// This is a rough note, not the vehicle record — admin types the real one at
// the office with the car in front of them. So the bar is low: enough to
// know what is turning up and roughly how long it will take.
//
// It cannot catch nonsense, and pretending otherwise would be dishonest.
// "jlkhlhk" is a plausible string and no rule will say it is not a brand.
// What it does catch is the shape of a mistake: a year that is not a year,
// a field with no letters in it, a single stray character. Beyond that the
// check is the inspection itself, which is the point of the appointment —
// nobody is listed from what they typed here.

// A vehicle on the road today was built somewhere in this range. Next year
// is allowed because new models are sold ahead of their model year.
export const OLDEST_VEHICLE_YEAR = 1950;

export function vehicleNoteProblem(vehicle, now = new Date()) {
  const brand = String(vehicle?.brand || '').trim();
  const model = String(vehicle?.model || '').trim();

  if (brand.length < 2) return 'Please say what brand it is.';
  // Letters, not just punctuation or digits. Every brand has a name.
  if (!/[a-z]/i.test(brand)) return 'That brand does not look right. Please check it.';
  if (brand.length > 60) return 'That brand is too long. Please shorten it.';

  if (!model) return 'Please say what model it is.';
  // Models can be bare numbers — a Mazda 3, a BMW 5 — so a digit counts.
  if (!/[a-z0-9]/i.test(model)) return 'That model does not look right. Please check it.';
  if (model.length > 60) return 'That model is too long. Please shorten it.';

  // Optional. Given at all, it has to be a year.
  if (vehicle?.year !== undefined && vehicle?.year !== null && String(vehicle.year).trim() !== '') {
    const year = Number(vehicle.year);
    const newest = new Date(now).getFullYear() + 1;
    if (!Number.isInteger(year) || year < OLDEST_VEHICLE_YEAR || year > newest) {
      return `Please enter a year between ${OLDEST_VEHICLE_YEAR} and ${newest}, or leave it blank.`;
    }
  }

  return null;
}

// Whether an appointment can be marked yet, and why not.
//
// Only the no-show waits. Somebody ten minutes into their hour is late
// rather than absent, so it cannot be true until the slot has run out, and
// the slot length is what decides when that is.
//
// Approving or turning a vehicle away is deliberately NOT restricted. It
// looks like the same kind of claim, but it is admin's call about their own
// business — somebody who drops the vehicle off a day early, or settles it
// over the phone, still needs recording, and a rule that waits for the
// clock would have them unable to write down what they have already done.
export function outcomeTooEarly(at, outcome, slotMinutes = APPOINTMENT_DEFAULTS.slotMinutes, now = new Date()) {
  if (outcome !== 'missed') return null;
  const starts = new Date(at).getTime();
  const ends = starts + Math.max(1, Number(slotMinutes) || APPOINTMENT_DEFAULTS.slotMinutes) * 60 * 1000;
  return new Date(now).getTime() < ends
    ? 'That slot has not finished yet, so nobody has missed it.'
    : null;
}

// What somebody confirms they have actually looked at before a vehicle is
// taken on. Shared so the list on screen and the list stored on the record
// are the same list, and so changing it changes both.
//
// It cannot make anybody look. It can make sure nobody reaches the end of
// the form without having been asked — which is the whole of what a
// checklist does, and worth not overstating.
export const INSPECTION_CHECKS = [
  { key: 'vehicle_present', label: 'The vehicle is here and matches what they booked' },
  { key: 'or_original', label: 'The OR is the original, not a copy' },
  { key: 'cr_original', label: 'The CR is the original, not a copy' },
  { key: 'plate_matches', label: 'The plate on the vehicle matches the CR' },
  { key: 'name_matches', label: "The name on the CR matches the owner's ID" },
  { key: 'roadworthy', label: 'The vehicle is roadworthy and fit to rent out' },
];

export const isInspectionCheck = (key) => INSPECTION_CHECKS.some((c) => c.key === key);

// Which states still hold their slot, and which are finished with.
export const APPOINTMENT_OPEN = ['requested', 'accepted'];
export const isAppointmentOpen = (status) => APPOINTMENT_OPEN.includes(status);
