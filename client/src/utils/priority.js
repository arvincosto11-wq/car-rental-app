// What order a list of bookings should be read in.
//
// Both lists were sorted by when the booking was made, which answers a
// question nobody asks. What somebody opening Manage Bookings wants to know
// is what needs doing next, and a booking taken this morning for a trip in
// March is not that.
//
// One idea, not five: every booking has a moment when somebody next has to
// act on it, and the list runs from the most overdue to the furthest away.
// A tier comes first because kind outranks clock — a vehicle nobody has
// seen since Tuesday matters more than a pickup at nine, however close nine
// is — and within a tier the clock decides.

export const TIER = {
  MISSING: 0,   // the vehicle is out past its return: an asset unaccounted for
  DECIDE: 1,    // somebody is waiting on an answer
  SCHEDULED: 2, // it has a moment coming, near or far
  DONE: 3,      // nothing left to do
};

const time = (d) => (d ? new Date(d).getTime() : 0);

const isOut = (b) => !!b.collectedAt && !b.returnedAt;

// Admin's view of what a booking is asking of them.
function adminPriority(booking, now) {
  const { status } = booking;
  if (status === 'completed' || status === 'cancelled') {
    // Finished, so it sinks — newest first among themselves, since the only
    // reason to look at one is that it happened recently.
    return { tier: TIER.DONE, at: -time(booking.returnedAt || booking.updatedAt || booking.createdAt) };
  }
  if (status === 'confirmed' && isOut(booking) && time(booking.endDate) < +now) {
    // Longest missing first.
    return { tier: TIER.MISSING, at: time(booking.endDate) };
  }
  if (
    status === 'pending'
    || booking.refundStatus === 'requested'
    || booking.rescheduleRequest?.status === 'pending'
    || booking.adjustOffer?.status === 'open'
  ) {
    // Whoever has waited longest has waited longest.
    return { tier: TIER.DECIDE, at: time(booking.createdAt) };
  }
  // Out already: the next moment is the return. Otherwise it is the pickup.
  return { tier: TIER.SCHEDULED, at: time(isOut(booking) ? booking.endDate : booking.startDate) };
}

// The client's view, which is a different question: not "what must I
// action" but "what is happening to me, and what do I owe".
function clientPriority(booking, now) {
  const { status } = booking;
  if (status === 'completed' || status === 'cancelled') {
    return { tier: TIER.DONE, at: -time(booking.returnedAt || booking.updatedAt || booking.createdAt) };
  }
  if (status === 'confirmed' && isOut(booking) && time(booking.endDate) < +now) {
    // They are being charged for every day this stays true.
    return { tier: TIER.MISSING, at: time(booking.endDate) };
  }
  if (booking.adjustOffer?.status === 'open') {
    // Theirs to answer, and it expires. Soonest deadline first.
    return { tier: TIER.DECIDE, at: time(booking.adjustOffer.deadline) };
  }
  if (booking.payment !== 'paid') {
    // A checkout they walked away from: nothing is held until they finish.
    return { tier: TIER.DECIDE, at: time(booking.createdAt) };
  }
  return { tier: TIER.SCHEDULED, at: time(isOut(booking) ? booking.endDate : booking.startDate) };
}

export function bookingPriority(booking, { role = 'admin', now = new Date() } = {}) {
  return role === 'client' ? clientPriority(booking, now) : adminPriority(booking, now);
}

// Sorts in place and returns the array, so a route can hand it straight on.
export function byUrgency(bookings, { role = 'admin', now = new Date() } = {}) {
  return bookings.sort((a, b) => {
    const pa = bookingPriority(a, { role, now });
    const pb = bookingPriority(b, { role, now });
    return pa.tier - pb.tier || pa.at - pb.at;
  });
}

// Records that somebody changed something, in words a person would use.
// Called only where a person acted — never from a sweep, a backfill or a
// nightly job, because those are not news to anybody.
export function recordActivity(booking, by, what) {
  booking.lastActivity = { at: new Date(), by, what };
  return booking;
}
