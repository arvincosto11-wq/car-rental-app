import { phYmd } from './phTime';

// Whether a vehicle's registration lasts as long as the booking does.
//
// The same question documents.js asks about a client's licence, asked about
// the vehicle instead. A CR that expires on Thursday is fine today and
// useless on a trip that runs to Saturday — and it is the renter who gets
// stopped, holding papers that ran out while they had the car.
//
// The date was already collected, already editable by admin, and already
// shown on the Expiring Documents page. It simply never stopped anybody
// booking.
//
// Compared as calendar days in Philippine time, not as instants: a
// registration expiring on the 25th is good for the whole of the 25th, and
// a UTC comparison would retire it eight hours early.

const ymdOf = (date) => (date ? phYmd(date) : '');

const outlasts = (expiry, until) => ymdOf(expiry) >= ymdOf(until);

// Why this vehicle can't take this booking, or null.
//
// A blank expiry is NOT a problem. Vehicles added before the field existed
// have none on file, and taking them off the road over missing paperwork
// rather than expired paperwork would be a worse mistake than the one this
// fixes. Those are chased on the Expiring Documents page instead.
export function registrationProblem(car, { endDate } = {}, now = new Date()) {
  if (!car?.registrationExpiry) return null;
  const expiry = new Date(car.registrationExpiry);
  if (!outlasts(expiry, now)) return { kind: 'expired', expiry };
  if (endDate && !outlasts(expiry, endDate)) return { kind: 'expires_during', expiry };
  return null;
}

// True when the vehicle cannot be rented out at all today. Used for the
// badge and the vehicle page, where there is no trip to measure against.
export const registrationLapsed = (car, now = new Date()) =>
  registrationProblem(car, {}, now)?.kind === 'expired';

// What the client reads. Never says "expired registration" as a bare fact —
// it says what it means for them, which is that this vehicle cannot go out.
export function registrationMessage(problem) {
  if (!problem) return '';
  if (problem.kind === 'expired') {
    return 'This vehicle is off the road while its registration is renewed. Please choose another vehicle.';
  }
  return `This vehicle's registration runs out on ${new Date(problem.expiry).toLocaleDateString()}, `
    + 'before your trip would end, so it cannot be rented for these dates. '
    + 'Please choose earlier dates or another vehicle.';
}
