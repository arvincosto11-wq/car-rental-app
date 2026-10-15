// Whether this vehicle can legally leave the yard today, for this trip.
//
// Every other door already asked: creating a booking, confirming one,
// extending it, moving it to another vehicle. The counter did not, so a
// booking confirmed while the papers were good could still hand over
// after they had lapsed — the one moment where it actually matters,
// because this is when the vehicle goes on the road.
//
// Shared by the server, which refuses, and by the Pickup Desk, which says
// so before anybody starts the handover. A screen can be ticked from
// memory; the route is what holds.

import { registrationProblem } from './registration.js';

export function handoverBlock(car, booking, now = new Date()) {
  if (car?.offRoad?.since) return { kind: 'off_road' };
  const papers = registrationProblem(car, { endDate: booking?.endDate }, now);
  if (papers) return { kind: papers.kind, expiry: papers.expiry };
  return null;
}

// What the office reads, in the words the rest of the admin uses. Always
// ends with the way out, because the way out is one click from the desk.
export function handoverBlockMessage(block) {
  if (!block) return '';
  if (block.kind === 'off_road') {
    return 'This vehicle is off the road, so it cannot be handed over. '
      + 'Put it back on the road in Manage Cars first, or move this booking to another vehicle.';
  }
  if (block.kind === 'expired') {
    return 'This vehicle’s registration has expired, so it cannot be handed over. '
      + 'Renew the expiry date in Manage Cars, or move this booking to another vehicle.';
  }
  return `This vehicle’s registration runs out on ${new Date(block.expiry).toLocaleDateString()}, `
    + 'before this booking ends, so it cannot be handed over. '
    + 'Renew the expiry date in Manage Cars, or move this booking to another vehicle.';
}
