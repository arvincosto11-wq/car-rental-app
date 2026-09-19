import Booking from '../models/Booking.js';
import { notifyAdmins } from '../utils/notify.js';

// A paid booking that admin never confirms is the one failure in this system
// where the client has already handed over money and can lose a trip without
// anyone noticing. Admin is notified once when payment lands (see
// reconcileBookingPayment) and the sidebar carries a live count, but both are
// passive — nothing gets louder as the pickup date approaches.
//
// This escalates. Tiers are keyed off HOURS UNTIL PICKUP rather than time
// since booking, because that's what actually determines how much trouble
// the client is in: a booking made in March for a trip in June can sit for
// weeks harmlessly, while one made this morning for this afternoon cannot.
//
// A booking for today therefore starts at the urgent tier on the first sweep
// rather than working its way up from the bottom.
const TIERS = [
  {
    tier: 1,
    maxHours: 72,
    title: 'Booking awaiting confirmation',
    urgency: (h) => `Pickup is in about ${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}.`,
  },
  {
    tier: 2,
    maxHours: 24,
    title: 'Booking still unconfirmed — pickup tomorrow',
    urgency: (h) => `Pickup is in about ${Math.max(1, Math.round(h))} hour${Math.round(h) === 1 ? '' : 's'}.`,
  },
  {
    tier: 3,
    maxHours: 6,
    title: 'URGENT: pickup today, booking not confirmed',
    urgency: (h) => (h <= 1 ? 'Pickup is within the hour.' : `Pickup is in about ${Math.round(h)} hours.`),
  },
  {
    tier: 4,
    maxHours: 0,
    title: 'Overdue: pickup time passed without confirmation',
    urgency: () => 'The pickup time has already passed and this booking was never confirmed. The client has paid.',
  },
];

// Highest tier whose threshold this booking has crossed, or 0 if it's still
// far enough out to be nobody's problem yet.
const tierFor = (hoursUntilPickup) => {
  if (hoursUntilPickup <= 0) return TIERS[3];
  const matched = TIERS.filter((t) => t.maxHours > 0 && hoursUntilPickup <= t.maxHours);
  return matched.length ? matched[matched.length - 1] : null;
};

export async function remindStalePendingBookings() {
  try {
    // payment: 'paid' matches how the admin sidebar already counts these —
    // an unpaid request isn't actionable, so nagging about it would train
    // admin to ignore the notification that matters.
    const stale = await Booking.find({ status: 'pending', payment: 'paid' })
      .populate('car', 'brand model')
      .populate('user', 'name');

    const now = Date.now();

    for (const booking of stale) {
      const hoursUntilPickup = (new Date(booking.startDate).getTime() - now) / (1000 * 60 * 60);
      const next = tierFor(hoursUntilPickup);
      // Each tier fires once. Without this the sweep would re-notify on
      // every request that triggers it, which is several per page load.
      if (!next || next.tier <= (booking.confirmReminderTier || 0)) continue;

      const who = booking.user?.name || 'A client';
      const what = booking.car ? `${booking.car.brand} ${booking.car.model}` : 'a vehicle';
      const when = new Date(booking.startDate).toLocaleDateString();

      await notifyAdmins(
        next.title,
        `${who} paid for ${what} on ${when} and it's still waiting to be confirmed. ${next.urgency(hoursUntilPickup)}`,
        '/admin/manage-bookings'
      );

      booking.confirmReminderTier = next.tier;
      await booking.save();
    }
  } catch (err) {
    // Never let a reminder failure break the request that triggered it —
    // this is background work riding along on a user's page load.
    console.error('Pending-booking reminder sweep failed:', err.message);
  }
}
