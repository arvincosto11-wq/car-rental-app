import express from 'express';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Consignment from '../models/Consignment.js';
import Car from '../models/Car.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { remindStalePendingBookings } from '../utils/pendingReminders.js';
import { expireAdjustOffers } from '../utils/adjustOffer.js';

const router = express.Router();

// Live counts of unresolved items per admin section, used to badge the
// sidebar. Deliberately NOT based on Notification read/unread state —
// that lagged behind reality (a badge stayed lit after the admin actually
// resolved something through the normal workflow, since resolving an item
// doesn't mark its notification read). These counts always reflect the
// current data, so a badge clears the instant the underlying item is
// actually handled.
const EXPIRY_WINDOW_DAYS = 30;

router.get('/pending-counts', protect, adminOnly, async (req, res) => {
  try {
    // The admin dashboard polls this, so an open dashboard keeps the
    // escalation moving even when no client is browsing.
    await remindStalePendingBookings();
    // An unanswered offer of alternative dates has to refund itself on time
    // even if no client happens to load a page — the dashboard poll is the
    // one thing that runs reliably.
    await expireAdjustOffers();
    const expiryCutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [pendingBookings, refundRequests, rescheduleRequests, pendingConsignments, pendingAvailability, pendingBlockedDates, expiringLicenses, expiringRegistrations] = await Promise.all([
      Booking.countDocuments({ status: 'pending', payment: 'paid', 'adjustOffer.status': { $ne: 'open' } }),
      Booking.countDocuments({ refundStatus: 'requested' }),
      Booking.countDocuments({ 'rescheduleRequest.status': 'pending' }),
      // Manage Clients no longer carries a badge: there is no ID photo to
      // review any more, so nothing arrives there needing a decision. See
      // models/User.js.
      Consignment.countDocuments({ status: 'pending' }),
      Car.countDocuments({ 'availabilityRequest.status': 'pending' }),
      // A car can have several pending blocked-date ranges at once (unlike
      // the single-slot availabilityRequest), so this counts individual
      // requests via $unwind rather than cars.
      Car.aggregate([
        { $unwind: '$blockedDates' },
        { $match: { 'blockedDates.status': 'pending' } },
        { $count: 'count' },
      ]),
      User.countDocuments({ role: 'user', licenseExpiry: { $ne: null, $lte: expiryCutoff } }),
      Car.countDocuments({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: expiryCutoff } }),
    ]);
    res.json({
      '/admin/manage-bookings': pendingBookings + refundRequests + rescheduleRequests,
      '/admin/manage-consignments': pendingConsignments,
      '/admin/availability-requests': pendingAvailability + (pendingBlockedDates[0]?.count || 0),
      '/admin/expiring-documents': expiringLicenses + expiringRegistrations,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Everything with an on-file expiry date that's already expired or due
// within the next 30 days, across the three document types that actually
// carry one: a user's valid ID, a user's driver's license, and a car's
// registration (CR). Consolidated into one response instead of three
// separate checks, since admin cares about "what needs attention soon"
// as a single list, not which category it happens to be.
router.get('/expiring-documents', protect, adminOnly, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [licenseUsers, registrationCars] = await Promise.all([
      User.find({ role: 'user', licenseExpiry: { $ne: null, $lte: cutoff } })
        .select('name email licenseExpiry')
        .sort({ licenseExpiry: 1 }),
      Car.find({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: cutoff } })
        .select('brand model plateNumber registrationExpiry owner')
        .populate('owner', 'name')
        .sort({ registrationExpiry: 1 }),
    ]);

    res.json({
      licenses: licenseUsers.map((u) => ({ userId: u._id, name: u.name, email: u.email, expiry: u.licenseExpiry })),
      registrations: registrationCars.map((c) => ({
        carId: c._id, brand: c.brand, model: c.model, plateNumber: c.plateNumber,
        ownerName: c.owner?.name || null, expiry: c.registrationExpiry,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Everything the admin dashboard draws, worked out here instead of shipped.
//
// It used to ask for every booking in the system — 164 of them, with their
// vehicles attached, about 400 KB — and then count them in the browser to
// show four numbers, a six-month chart, five rows and five vehicles. The
// counting is the cheap part; the carrying was the expensive one.
//
// Dates are measured in Philippine time rather than the browser's, so the
// figure does not shift depending on which machine is looking at it. The
// boundaries come back with the numbers so the captions can say exactly
// what period they describe.
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const phNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    // Month boundaries built from PH wall-clock parts, then shifted back to
    // real instants to compare against stored dates.
    const phMonthStart = (back) => new Date(Date.UTC(
      phNow.getUTCFullYear(),
      phNow.getUTCMonth() - back,
      1,
    ) - 8 * 60 * 60 * 1000);
    const startOfMonth = phMonthStart(0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Only the two fields the sums need. Confirmed-only, which is what this
    // dashboard has always counted as revenue.
    const [cars, confirmedMoney, statusCounts, totalBookings, recent] = await Promise.all([
      Car.find({ archived: { $ne: true } })
        .select('brand model image avgRating ratingCount')
        .lean(),
      Booking.find({ status: 'confirmed' }).select('createdAt totalPrice').lean(),
      Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Booking.countDocuments(),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('status totalPrice createdAt startDate car')
        .populate('car', 'brand model image')
        .lean(),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]));
    const sumSince = (cutoff) => confirmedMoney
      .filter((b) => new Date(b.createdAt) >= cutoff)
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Six buckets ending with the month we are in, labelled the way the
    // chart prints them.
    const trend = Array.from({ length: 6 }).map((unused, i) => {
      const start = phMonthStart(5 - i);
      const end = phMonthStart(4 - i);
      return {
        label: new Date(start.getTime() + 8 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        value: confirmedMoney
          .filter((b) => {
            const at = new Date(b.createdAt);
            return at >= start && at < end;
          })
          .reduce((sum, b) => sum + (b.totalPrice || 0), 0),
      };
    });

    res.json({
      stats: {
        totalCars: cars.length,
        totalBookings,
        pending: byStatus.pending || 0,
        confirmed: byStatus.confirmed || 0,
      },
      revenue: {
        week: sumSince(startOfWeek),
        month: sumSince(startOfMonth),
        all: confirmedMoney.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
      },
      monthlyTrend: trend,
      recentBookings: recent,
      topRatedCars: cars
        .filter((c) => c.ratingCount > 0)
        .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount)
        .slice(0, 5),
      periods: { weekStart: startOfWeek, monthStart: startOfMonth, today: now },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
