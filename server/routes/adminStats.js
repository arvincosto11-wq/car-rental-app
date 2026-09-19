import express from 'express';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Consignment from '../models/Consignment.js';
import Car from '../models/Car.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { remindStalePendingBookings } from '../utils/pendingReminders.js';

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
    const expiryCutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [pendingBookings, refundRequests, rescheduleRequests, pendingClients, pendingConsignments, pendingAvailability, pendingBlockedDates, expiringValidIds, expiringLicenses, expiringRegistrations] = await Promise.all([
      Booking.countDocuments({ status: 'pending', payment: 'paid' }),
      Booking.countDocuments({ refundStatus: 'requested' }),
      Booking.countDocuments({ 'rescheduleRequest.status': 'pending' }),
      // Scoped to role: 'user' — Manage Clients only ever lists and can
      // verify plain clients, not consignors. Counting consignors here too
      // made this badge permanently stuck, since there was no way to ever
      // resolve them from that page. Also counts already-verified users
      // with a pending ID update awaiting re-review (see PUT /auth/me).
      User.countDocuments({
        role: 'user',
        $or: [
          { validIdImage: { $ne: '' }, idVerified: false },
          { pendingIdSubmittedAt: { $ne: null } },
        ],
      }),
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
      User.countDocuments({ validIdExpiry: { $ne: null, $lte: expiryCutoff } }),
      User.countDocuments({ role: 'user', licenseExpiry: { $ne: null, $lte: expiryCutoff } }),
      Car.countDocuments({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: expiryCutoff } }),
    ]);
    res.json({
      '/admin/manage-bookings': pendingBookings + refundRequests + rescheduleRequests,
      '/admin/manage-clients': pendingClients,
      '/admin/manage-consignments': pendingConsignments,
      '/admin/availability-requests': pendingAvailability + (pendingBlockedDates[0]?.count || 0),
      '/admin/expiring-documents': expiringValidIds + expiringLicenses + expiringRegistrations,
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

    const [validIdUsers, licenseUsers, registrationCars] = await Promise.all([
      User.find({ validIdExpiry: { $ne: null, $lte: cutoff } })
        .select('name email role validIdExpiry')
        .sort({ validIdExpiry: 1 }),
      User.find({ role: 'user', licenseExpiry: { $ne: null, $lte: cutoff } })
        .select('name email licenseExpiry')
        .sort({ licenseExpiry: 1 }),
      Car.find({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: cutoff } })
        .select('brand model plateNumber registrationExpiry owner')
        .populate('owner', 'name')
        .sort({ registrationExpiry: 1 }),
    ]);

    res.json({
      validIds: validIdUsers.map((u) => ({ userId: u._id, name: u.name, email: u.email, role: u.role, expiry: u.validIdExpiry })),
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

export default router;
