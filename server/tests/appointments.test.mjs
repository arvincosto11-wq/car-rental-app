import { suite, group, check } from './harness.mjs';
import {
  appointmentSettings, openSlots, slotProblem, phInstant, phDay, phWeekday, slotLabel,
  APPOINTMENT_DEFAULTS, vehicleNoteProblem, OLDEST_VEHICLE_YEAR,
} from '../utils/appointments.js';

// Thursday 1 October 2026, 10:00 in Legazpi.
const now = phInstant('2026-10-01', 10);

// Open every day, so a test about times is not also a test about weekdays.
const everyDay = { appointments: { days: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 12, slotMinutes: 60, leadHours: 0 } };

export default function run() {
  suite('Appointments');

  group('wall-clock time in Legazpi, whatever the server thinks');
  check('a 9 AM slot is 9 AM', slotLabel(phInstant('2026-10-02', 9)), '9:00 AM');
  check('and the afternoon reads as the afternoon', slotLabel(phInstant('2026-10-02', 16)), '4:00 PM');
  check('noon is not 0', slotLabel(phInstant('2026-10-02', 12)), '12:00 PM');
  check('midnight is not 24', slotLabel(phInstant('2026-10-02', 0)), '12:00 AM');
  // 9 AM in Legazpi is 1 AM UTC the same day — a UTC reading of the date
  // would be right here and wrong eight hours either side of it.
  check('the day it falls on is the PH day', phDay(phInstant('2026-10-02', 7)), '2026-10-02');
  check('early morning still belongs to that day', phDay(phInstant('2026-10-02', 1)), '2026-10-02');
  check('and late evening does too', phDay(phInstant('2026-10-02', 23)), '2026-10-02');
  check('Thursday is Thursday', phWeekday(phInstant('2026-10-01', 9)), 4);

  group('the slots that exist');
  // 9 to 12 in hour blocks is three: 9, 10, 11. The noon one would end at
  // one o'clock, past closing.
  const oneDay = openSlots(everyDay, { now: phInstant('2026-10-02', 0) })
    .filter((s) => s.day === '2026-10-02');
  check('three in a 9-to-12 day', oneDay.length, 3);
  check('starting at opening', oneDay[0].label, '9:00 AM');
  check('and the last one ends at closing', oneDay[2].label, '11:00 AM');
  // Half-hour inspections mean twice as many, not a half slot at the end.
  const half = openSlots({ appointments: { ...everyDay.appointments, slotMinutes: 30 } }, { now: phInstant('2026-10-02', 0) })
    .filter((s) => s.day === '2026-10-02');
  check('six when each takes half an hour', half.length, 6);

  group('the days you are open');
  // Weekdays only: Saturday the 3rd and Sunday the 4th should not appear.
  const weekdays = { appointments: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 10, leadHours: 0 } };
  const offered = openSlots(weekdays, { now }).map((s) => s.day);
  check('no Saturday', offered.includes('2026-10-03'), false);
  check('no Sunday', offered.includes('2026-10-04'), false);
  check('but Monday is there', offered.includes('2026-10-05'), true);
  check('turned off entirely offers nothing', openSlots({ appointments: { enabled: false } }, { now }).length, 0);

  group('how soon somebody can come');
  // A day's notice: nothing tomorrow morning if it is 10 AM today and the
  // lead time is 24 hours.
  const dayAhead = { appointments: { ...everyDay.appointments, leadHours: 24 } };
  const soonest = openSlots(dayAhead, { now })[0];
  check('nothing before the lead time', soonest.at.getTime() >= now.getTime() + 24 * 3600000, true);
  check('nothing today at all', openSlots(dayAhead, { now }).some((s) => s.day === '2026-10-01'), false);
  // With no lead time, this morning's 9 AM is already gone but 11 AM is not.
  const today = openSlots(everyDay, { now }).filter((s) => s.day === '2026-10-01');
  check('a slot that has passed is not offered', today.some((s) => s.label === '9:00 AM'), false);
  check('a later one today still is', today.some((s) => s.label === '11:00 AM'), true);

  group('how far ahead the calendar runs');
  const short = openSlots({ appointments: { ...everyDay.appointments, horizonDays: 3 } }, { now });
  check('stops at the horizon', short.every((s) => s.day <= '2026-10-03'), true);
  check('and still offers something', short.length > 0, true);

  group('a time somebody else has');
  const wanted = phInstant('2026-10-02', 10);
  const free = openSlots(everyDay, { now });
  const after = openSlots(everyDay, { now, taken: [wanted] });
  check('one fewer on offer', free.length - after.length, 1);
  check('and it is that one', after.some((s) => s.at.getTime() === wanted.getTime()), false);
  // One vehicle per slot, so the same time on a different day is untouched.
  check('the next day is unaffected', after.some((s) => s.at.getTime() === phInstant('2026-10-03', 10).getTime()), true);

  group('what the server refuses');
  check('a free, open slot passes', slotProblem(phInstant('2026-10-02', 10), everyDay, { now }), null);
  check('one already taken', !!slotProblem(wanted, everyDay, { now, taken: [wanted] }), true);
  // 1 PM when you close at noon.
  check('outside opening hours', !!slotProblem(phInstant('2026-10-02', 13), everyDay, { now }), true);
  // 9:30 when inspections are on the hour.
  check('between the slots', !!slotProblem(phInstant('2026-10-02', 9, 30), everyDay, { now }), true);
  check('a day you are closed', !!slotProblem(phInstant('2026-10-03', 10), weekdays, { now }), true);
  check('in the past', !!slotProblem(phInstant('2026-09-30', 10), everyDay, { now }), true);
  check('beyond the horizon', !!slotProblem(phInstant('2027-06-01', 10), everyDay, { now }), true);
  check('not a time at all', !!slotProblem('whenever', everyDay, { now }), true);
  check('nothing booked while closed', !!slotProblem(phInstant('2026-10-02', 10), { appointments: { enabled: false } }, { now }), true);

  group('settings that are half filled in');
  check('keeps what was set', appointmentSettings({ appointments: { startHour: 7 } }).startHour, 7);
  check('fills in the rest', appointmentSettings({ appointments: { startHour: 7 } }).slotMinutes, APPOINTMENT_DEFAULTS.slotMinutes);
  check('nothing at all still works', appointmentSettings(null).days.length, APPOINTMENT_DEFAULTS.days.length);
  // Typed backwards, this would generate no slots at all and read as a
  // broken page rather than a setting somebody got the wrong way round.
  check('closing before opening is corrected', appointmentSettings({ appointments: { startHour: 14, endHour: 9 } }).endHour, 15);
  check('an empty day list falls back', appointmentSettings({ appointments: { days: [] } }).days.length, APPOINTMENT_DEFAULTS.days.length);
  check('nonsense days are dropped', appointmentSettings({ appointments: { days: [1, 9, -2, 3] } }).days.join(','), '1,3');
  check('duplicate days collapse', appointmentSettings({ appointments: { days: [2, 2, 2] } }).days.join(','), '2');
  // The flattened form the API serves, handed straight back.
  const flat = appointmentSettings({ appointments: { startHour: 8, endHour: 11 } });
  check('flattening twice changes nothing', appointmentSettings(flat).startHour, 8);
  check('and a slot list off it agrees', openSlots(flat, { now }).length, openSlots({ appointments: flat }, { now }).length);

  group('what somebody says they are bringing');
  const car = (over = {}) => ({ brand: 'Toyota', model: 'Vios', year: 2019, ...over });
  check('an ordinary one', vehicleNoteProblem(car(), now), null);
  check('no year is fine', vehicleNoteProblem(car({ year: '' }), now), null);
  check('nor is a missing one', vehicleNoteProblem({ brand: 'Honda', model: 'Click' }, now), null);
  // Models are allowed to be bare numbers: a Mazda 3, a BMW 5.
  check('a numeric model', vehicleNoteProblem(car({ model: '3' }), now), null);

  check('no brand', !!vehicleNoteProblem(car({ brand: '' }), now), true);
  check('one letter of brand', !!vehicleNoteProblem(car({ brand: 'T' }), now), true);
  // Punctuation is not a name.
  check('a brand with no letters', !!vehicleNoteProblem(car({ brand: '...' }), now), true);
  check('no model', !!vehicleNoteProblem(car({ model: '' }), now), true);
  check('a model of punctuation', !!vehicleNoteProblem(car({ model: '--' }), now), true);
  check('a very long brand', !!vehicleNoteProblem(car({ brand: 'x'.repeat(61) }), now), true);

  group('the year has to be a year');
  // The one this came from: seven digits typed into a number box.
  check('0980980', !!vehicleNoteProblem(car({ year: '0980980' }), now), true);
  check('before cars existed', !!vehicleNoteProblem(car({ year: 1800 }), now), true);
  check('far in the future', !!vehicleNoteProblem(car({ year: 2099 }), now), true);
  check('not a number', !!vehicleNoteProblem(car({ year: 'soon' }), now), true);
  check('a fraction', !!vehicleNoteProblem(car({ year: 2019.5 }), now), true);
  check('the oldest allowed', vehicleNoteProblem(car({ year: OLDEST_VEHICLE_YEAR }), now), null);
  // Next year is allowed: new models are sold ahead of their model year.
  check('next year', vehicleNoteProblem(car({ year: new Date(now).getFullYear() + 1 }), now), null);
  check('the year after next', !!vehicleNoteProblem(car({ year: new Date(now).getFullYear() + 2 }), now), true);

  // What it cannot do, written down so nobody mistakes it for a guarantee.
  // No rule tells a made-up word from a real brand; the inspection does.
  check('nonsense that looks like a word passes', vehicleNoteProblem(car({ brand: 'Jlkhlhk', model: 'Khgkhvk' }), now), null);
}
