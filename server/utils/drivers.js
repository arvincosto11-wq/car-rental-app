// The people who drive, for a booking made with a driver.
//
// Deliberately thin. A driver here is a name, a number to ring and whether
// they are working at the moment — nothing else. No licence, no ID, no
// photograph: the business keeps that side of it offline, and a system that
// holds documents it does not need is a system with documents to lose. Same
// reasoning as the identity documents that came out of the client records.
//
// The company pays its drivers, so nothing here touches money. A booking
// with a driver costs exactly what the same booking costs without one, and
// that is the single most useful fact about this feature: it cannot affect
// a total, a discount, a refund or a payment.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/drivers.js). What the form refuses and what the server
// refuses have to be the same thing.

// A Philippine mobile, the two ways people write one. Same rule the
// registration form has always used.
export const PH_MOBILE = /^(09\d{9}|\+639\d{9})$/;
export const PHONE_ERROR = 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';

export const MAX_NAME = 80;

// Spaces and dashes are how people actually type a number; they are not a
// reason to reject one. Taken out before checking and before storing, so
// the same driver cannot be entered twice in two spellings.
export const tidyPhone = (raw) => String(raw ?? '').replace(/[\s-]/g, '');

export const tidyName = (raw) => String(raw ?? '').trim().replace(/\s+/g, ' ');

// What is wrong with this driver, or null. A phone number is required
// rather than optional: the whole point of the record is being able to
// reach somebody on the morning they are supposed to be driving.
export function driverProblem({ name, phone } = {}) {
  const cleanName = tidyName(name);
  if (cleanName.length < 2) return 'Please enter the driver’s name.';
  if (cleanName.length > MAX_NAME) return `That name is too long — ${MAX_NAME} characters at most.`;
  // A name with no letters in it is a typo, not a person.
  if (!/[a-z]/i.test(cleanName)) return 'That name does not look right. Please check it.';

  const cleanPhone = tidyPhone(phone);
  if (!cleanPhone) return 'Please enter a phone number we can reach them on.';
  if (!PH_MOBILE.test(cleanPhone)) return PHONE_ERROR;

  return null;
}

// Whether a driver can be offered for a booking at all.
//
// Separate from whether they are free on a given date, which is a question
// about their trips — this is the standing answer: somebody who has left,
// or is off indefinitely, is not offered to anybody.
export const isWorking = (driver) => !!driver && driver.active !== false;

// How a driver reads to a customer: a name and a face, never the number.
// The phone is for the office. A list of drivers is shown on a booking
// page, and their mobile numbers have no business being on it.
//
// Built by naming what goes OUT rather than by deleting what must not, so
// a field added to the record later cannot leak by being forgotten about
// here.
export const publicDriver = (driver) => ({
  _id: driver._id,
  name: driver.name,
  image: driver.image || '',
  // What people they have driven say. Shown beside the name, because a
  // list of strangers to choose between tells somebody nothing on its own.
  avgRating: driver.avgRating || 0,
  ratingCount: driver.ratingCount || 0,
});

// How a rating reads before anybody has given one.
//
// "No rating yet" rather than a lonely zero or an empty row of stars: a
// driver on their first week has not been judged badly, and showing
// nothing at all reads as something withheld.
export const ratingLabel = (driver) => {
  const count = driver?.ratingCount || 0;
  if (!count) return 'New driver';
  return `${(driver.avgRating || 0).toFixed(1)} · ${count} trip${count === 1 ? '' : 's'}`;
};

// --- when somebody is free ------------------------------------------------
//
// A driver can be in one place at a time. Two trips that overlap are two
// trips one person cannot do, which is the whole of the rule.
//
// Only a CONFIRMED booking holds a driver. A pending request does not —
// exactly as a pending request does not hold the vehicle — so several
// customers can ask for the same driver and whoever is accepted first gets
// them. The one accepted second is caught at the counter rather than on
// the day: see the accept handler in routes/bookings.js.

export const spansOverlap = (a, b) => a.start < b.end && a.end > b.start;

// A gap either side of a trip, for the same reason vehicles have a
// turnaround: somebody who drops off in Tabaco at ten o'clock cannot start
// another trip in Camalig at ten o'clock. Two hours is what the vehicles
// use, and a driver has at least as far to travel as the car does.
export const DRIVER_GAP_HOURS = 2;

const widen = (span, hours) => ({
  start: new Date(new Date(span.start).getTime() - hours * 3600000),
  end: new Date(new Date(span.end).getTime() + hours * 3600000),
});

// Whether a driver can take this trip, given the ones they already have.
//
// The gap goes on the trips already booked rather than on the new one, so
// it is applied once rather than twice — padding both would quietly need
// four hours between jobs instead of two.
export function driverFreeFor(span, trips = []) {
  if (!span?.start || !span?.end) return false;
  const wanted = { start: new Date(span.start), end: new Date(span.end) };
  return !trips.some((trip) => spansOverlap(wanted, widen(trip, DRIVER_GAP_HOURS)));
}

// Why this driver cannot take this booking, or null.
//
// A booking with no driver is allowed on purpose: a customer who does not
// mind who drives leaves it to the office, and a booking made when nobody
// was free still has to be takeable. See the booking form.
export function driverChoiceProblem(driver, span, trips = []) {
  if (!driver) return null;
  if (!isWorking(driver)) return 'That driver is not available at the moment. Please choose another, or leave it to us.';
  if (!driverFreeFor(span, trips)) {
    return 'That driver is already out on another trip around those dates. Please choose another, or leave it to us.';
  }
  return null;
}
