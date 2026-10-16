import { registrationLapsed } from './registration';

// Can this vehicle go out at all, today?
//
// Three separate things stop it, and they are not the same thing:
//
//   isAvailable === false  the office took it off the list on purpose
//   offRoad.since          it is in the workshop, or otherwise not fit
//   lapsed registration    its papers have run out
//
// Only the first is a decision about listing; the other two are facts about
// the vehicle. They used to be checked in some places and not others, so a
// car that had been off the road for repairs since October still said it
// was available on the vehicles page while its own page said it was off
// the road and the server refused the booking.
export const offTheRoad = (car) => !!car?.offRoad?.since;

export const unbookable = (car) =>
  car?.isAvailable === false || offTheRoad(car) || registrationLapsed(car);

// What to call it on a card, in a client's words rather than the office's.
//
// There are three states behind this and the admin needs all three — off
// the road, papers run out, listing switched off — but a client wants one
// answer: can I rent this or not. "Not listed" in particular is the
// office's own vocabulary; somebody looking for a car to drive on Saturday
// has no idea what it means, and does not need to.
//
// "Available" rather than "Available now": whether a vehicle is free on
// your dates is answered by the calendar on its own page. This says only
// that it is one of the vehicles we rent out.
export const availabilityLabel = (car) => (unbookable(car) ? 'Not Available' : 'Available');
