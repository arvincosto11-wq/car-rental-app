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
// server/utils/drivers.js). What the form refuses and what the server
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

// How a driver reads to a customer: the name, never the number. The phone
// is for the office. A list of drivers is shown on a public booking page,
// and their mobile numbers have no business being on it.
export const publicDriver = (driver) => ({
  _id: driver._id,
  name: driver.name,
});
