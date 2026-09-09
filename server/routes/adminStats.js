import express from 'express';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Consignment from '../models/Consignment.js';
import Car from '../models/Car.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Live counts of unresolved items per admin section, used to badge the
// sidebar. Deliberately NOT based on Notification read/unread state —
// that lagged behind reality (a badge stayed lit after the admin actually
// resolved something through the normal workflow, since resolving an item
// doesn't mark its notification read). These counts always reflect the
// current data, so a badge clears the instant the underlying item is
// actually handled.
router.get('/pending-counts', protect, adminOnly, async (req, res) => {
  try {
    const [pendingBookings, refundRequests, rescheduleRequests, pendingClients, pendingConsignments, pendingAvailability] = await Promise.all([
      Booking.countDocuments({ status: 'pending', payment: 'paid' }),
      Booking.countDocuments({ refundStatus: 'requested' }),
      Booking.countDocuments({ 'rescheduleRequest.status': 'pending' }),
      User.countDocuments({ validIdImage: { $ne: '' }, idVerified: false }),
      Consignment.countDocuments({ status: 'pending' }),
      Car.countDocuments({ 'availabilityRequest.status': 'pending' }),
    ]);
    res.json({
      '/admin/manage-bookings': pendingBookings + refundRequests + rescheduleRequests,
      '/admin/manage-clients': pendingClients,
      '/admin/manage-consignments': pendingConsignments,
      '/admin/availability-requests': pendingAvailability,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
