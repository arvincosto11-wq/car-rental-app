// A booking nobody ever collected.
//
// The counter records a no-show on the day, and can only do so within a
// day of the pickup time — three days into a trip it is not a no-show,
// whatever else it might be. But nobody is at a desk on a public holiday,
// and a busy Saturday ends with buttons unpressed. What happened to those
// bookings before this existed is the reason it exists:
//
// The sweep that completes finished trips looked at a booking whose dates
// had passed, saw no record of a return, and concluded the trip had run
// its course. It stamped a collection time of its own invention onto it
// and marked the whole thing completed. So a customer who never turned up
// was asked to rate a journey they never took, the vehicle's owner was
// credited for a rental that never happened, and the money counted as
// earned. A no-show quietly became a success.
//
// This decides which ones were abandoned instead, and it runs first.
//
// It deliberately waits until the booking's whole period has gone by
// rather than firing when the counter's window shuts. A handover that
// happened and was never written down looks exactly like a no-show from
// here, and the only thing that tells them apart is somebody at the desk
// saying so — which they can still do, from the overlooked list, right up
// until the dates run out. Cancelling a trip somebody is actually on, and
// keeping their money for it, is a worse mistake than waiting a few days.

// Two things prove a vehicle went out, and neither needs anybody to have
// pressed anything today:
//
//   collectedAt  the counter recorded the handover
//   extensions   they asked to keep it longer, which they could hardly do
//                without having it
//
// Bookings made before handovers were recorded at all have neither, which
// is why the date test below is the one that does the real work.
export const wasCollected = (booking) => !!booking?.collectedAt || !!booking?.extensions?.length;

// Whether this booking should be written off as never collected.
//
// `dayStart` is the start of today in Philippine time, the same boundary
// the completion sweep uses — a return due this morning is not abandoned
// at one minute past midnight.
export function isAbandoned(booking, dayStart) {
  if (!booking || booking.status !== 'confirmed') return false;
  if (wasCollected(booking)) return false;
  if (!booking.endDate) return false;
  return new Date(booking.endDate) < new Date(dayStart);
}

// What the client is told, and what goes on the booking as the reason.
// The same words the counter's own no-show uses, because it is the same
// thing: the vehicle was there and nobody came for it.
export const NO_SHOW_REASON =
  'Client did not show up for pickup — the amount paid is forfeited as a no-show fee, per booking terms.';
