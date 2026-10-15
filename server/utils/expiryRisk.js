// Which booking a lapsing registration is about to spoil.
//
// The Expiring Documents page lists dates; this is what those dates cost.
// A vehicle whose papers run out next week is a quiet problem until a
// confirmed trip runs past that date — then it is somebody standing at
// the counter on the day.
//
// Compared as calendar days in Philippine time, like every other date
// rule here: papers expiring on the 31st are good for the whole of the
// 31st, and a trip ending on the 31st is fine.

import { phYmd } from './phTime.js';

// A trip is at risk when it is still ahead of us and the papers give out
// before it ends. Three shapes, because the office does something
// different about each:
//
//   before_pickup — the papers have already lapsed and the keys have not
//                   gone over yet. Renew before they do.
//   runs_past     — the trip starts while the papers are good and ends
//                   after they are not. It gets refused at confirmation
//                   or stops mid-trip.
//   starts_after  — the whole trip sits beyond the expiry date.
export function riskFor(car, bookings, now = new Date()) {
  if (!car?.registrationExpiry) return null;
  const expiry = phYmd(car.registrationExpiry);
  const today = phYmd(now);
  const lapsed = expiry < today;

  const mine = bookings
    .filter((b) => String(b.car?._id || b.car) === String(car._id))
    .filter((b) => b.status === 'confirmed')
    // A trip that is already over cannot be spoiled by anything.
    .filter((b) => phYmd(b.endDate) >= today)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  for (const b of mine) {
    const start = phYmd(b.startDate);
    const end = phYmd(b.endDate);
    if (lapsed) {
      // The keys are still here, so this one is stoppable.
      if (!b.collectedAt) return { kind: 'before_pickup', start: b.startDate, end: b.endDate };
      continue;
    }
    if (end > expiry) {
      return {
        kind: start > expiry ? 'starts_after' : 'runs_past',
        start: b.startDate,
        end: b.endDate,
      };
    }
  }
  return null;
}

// How many of a list of vehicles have something at risk. The page says
// this once, at the top, before anybody reads a single row.
export const countAtRisk = (risks) => risks.filter(Boolean).length;
