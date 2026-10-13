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
// car that had been off the road for repairs since October still said
// "Bookable" on the vehicles page while its own page said it was off the
// road and the server refused the booking.
export const offTheRoad = (car) => !!car?.offRoad?.since;

export const unbookable = (car) =>
  car?.isAvailable === false || offTheRoad(car) || registrationLapsed(car);

// What to call it on a card. "Not listed" is the office's choice and reads
// as one; a vehicle that physically cannot go out is "Not available",
// whichever of the two reasons it is.
export const availabilityLabel = (car) => {
  if (offTheRoad(car) || registrationLapsed(car)) return 'Not Available';
  if (car?.isAvailable === false) return 'Not Listed';
  return 'Bookable';
};
