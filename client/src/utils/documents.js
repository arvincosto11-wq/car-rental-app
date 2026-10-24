import { phYmd } from './phTime.js';

// Whether the papers a booking depends on last as long as the booking does.
//
// The checks that existed asked only "is it valid today?", which is the
// wrong question at booking time: a licence expiring on Thursday is fine
// today and useless on a trip that runs to Saturday. Asking it late meant
// finding out at the counter, where nobody can renew anything.
//
// Compared as calendar days in Philippine time, not as instants, because a
// licence expiring on the 25th is valid for the whole of the 25th — and
// because a UTC comparison would retire it eight hours early.

const ymdOf = (date) => (date ? phYmd(date) : '');

// Valid through the end of its expiry date, so it only fails a booking that
// runs past that day.
const outlasts = (expiry, until) => ymdOf(expiry) >= ymdOf(until);

// Why this client can't take this booking on their own licence, or null.
// With-driver bookings never ask: it isn't their licence doing the driving.
//
// Only the expiry is asked for. The licence number used to be required too,
// and it was the one piece of it worth stealing — a date is not. The licence
// itself is read at the counter, where the number is on the card in front of
// whoever is checking it.
export function licenceProblem(user, { bookingType, endDate }, now = new Date()) {
  if (bookingType !== 'self-drive') return null;
  if (!user?.licenseExpiry) return { kind: 'missing' };
  const expiry = new Date(user.licenseExpiry);
  if (!outlasts(expiry, now)) return { kind: 'expired', expiry };
  if (!outlasts(expiry, endDate)) return { kind: 'expires_during', expiry };
  return null;
}

// What to tell whoever is reading. Written for the client, since they are
// the ones who have to do something about it.
// Written for the client, since they are the ones who have to do something
// about it — and what they have to do is bring the licence to somebody, not
// type a date. The expiry is recorded by whoever has seen the card, so none
// of these sends anybody to their Profile to fix it: the Profile cannot.
export function licenceMessage(problem) {
  if (!problem) return '';
  if (problem.kind === 'missing') {
    return "Self-drive needs your driver's licence on record. Bring it to our office, or call us, and we'll "
      + 'add it. You can book with one of our drivers in the meantime.';
  }
  if (problem.kind === 'expired') {
    return "Your driver's licence has expired on our records. Bring the current one to our office, or call "
      + 'us to update it — or book with one of our drivers instead.';
  }
  return `Your driver's licence expires on ${new Date(problem.expiry).toLocaleDateString()}, before this trip ends, so you would be driving on an expired licence. `
    + 'Bring the renewed one to our office, or call us to update it — or book with one of our drivers instead.';
}
