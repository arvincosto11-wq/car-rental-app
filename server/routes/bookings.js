import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import User from '../models/User.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';

const router = express.Router();

async function recomputeCarRating(carId) {
  const [result] = await Booking.aggregate([
    { $match: { car: new mongoose.Types.ObjectId(carId), 'carRating.overall': { $exists: true } } },
    { $group: { _id: null, avg: { $avg: '$carRating.overall' }, count: { $sum: 1 } } }
  ]);
  await Car.findByIdAndUpdate(carId, {
    avgRating: result ? Math.round(result.avg * 10) / 10 : 0,
    ratingCount: result ? result.count : 0,
  });
}

async function recomputeClientRating(userId) {
  const [result] = await Booking.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), 'clientRating.rating': { $exists: true } } },
    { $group: { _id: null, avg: { $avg: '$clientRating.rating' }, count: { $sum: 1 } } }
  ]);
  await User.findByIdAndUpdate(userId, {
    avgRating: result ? Math.round(result.avg * 10) / 10 : 0,
    ratingCount: result ? result.count : 0,
  });
}

// Create booking
router.post('/', protect, async (req, res) => {
    try {
    const { carId, startDate, endDate, paymentType, amountPaid, totalPrice, bookingType, licenseNumber, licenseExpiry } = req.body;

    const currentUser = await User.findById(req.user.id);
    if (currentUser?.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked from making bookings. Please contact support.' });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    if (!car.isAvailable) {
      return res.status(400).json({ message: 'This car is currently unavailable.' });
    }

    const requestedType = bookingType || 'with-driver';
    const supportedTypes = car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'];
    if (!supportedTypes.includes(requestedType)) {
      return res.status(400).json({ message: `This vehicle does not offer ${requestedType === 'self-drive' ? 'self-drive' : 'with-driver'} bookings.` });
    }

    const existing = await Booking.findOne({
      user: req.user.id,
      car: carId,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have an active booking request for this car.' });
    }

    // Self-drive bookings require a valid, unexpired driver's license on file.
    // If the client just entered one on the booking form, save it to their profile first.
    if (bookingType === 'self-drive') {
      if (licenseNumber && licenseExpiry) {
        currentUser.licenseNumber = licenseNumber;
        currentUser.licenseExpiry = licenseExpiry;
        await currentUser.save();
      }

      if (!currentUser.licenseNumber || !currentUser.licenseExpiry) {
        return res.status(400).json({ message: "A driver's license is required to book self-drive." });
      }
      if (new Date(currentUser.licenseExpiry) < new Date()) {
        return res.status(400).json({ message: 'Your driver\'s license has expired. Please update it to book self-drive.' });
      }
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const booking = await Booking.create({
      user: req.user.id,
      car: carId,
      startDate: start,
      endDate: end,
      totalDays,
      totalPrice,
      amountPaid,
      paymentType,
      bookingType: bookingType || 'with-driver',
      payment: paymentType === 'full' ? 'paid' : 'offline'
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get logged-in user's bookings
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('car')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all bookings (admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('car')
      .populate('user', 'name email avgRating ratingCount')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get booking history for cars owned by the logged-in consignor (read-only —
// consignors can track bookings but cannot approve/decline them)
router.get('/owner', protect, consignorOnly, async (req, res) => {
  try {
    const cars = await Car.find({ owner: req.user.id }).select('_id');
    const carIds = cars.map((c) => c._id);
    const bookings = await Booking.find({ car: { $in: carIds } })
      .populate('car')
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update booking status (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const previousStatus = booking.status;

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      // Atomically claim the car only if it's still available. This prevents two
      // bookings for the same car both being confirmed (e.g. admin approving
      // both before the page refreshes, or two near-simultaneous requests).
      const car = await Car.findOneAndUpdate(
        { _id: booking.car, isAvailable: true },
        { isAvailable: false },
        { new: true }
      );

      if (!car) {
        // Car was already taken by another confirmed booking. Don't allow this
        // one to be confirmed too — send it straight to an approved refund instead.
        booking.status = 'cancelled';
        booking.refundStatus = 'approved';
        booking.refundReason = 'Automatically refunded: this car was already booked by another confirmed reservation.';
        await booking.save();

        await notifyUser(booking.user, 'Booking Cancelled & Refunded', 'Your booking request could not be confirmed because the vehicle was already booked. It has been cancelled and automatically approved for a refund.', '/my-bookings');

        return res.json({
          ...booking.toObject(),
          autoRefunded: true,
          message: 'This car was already booked by another client. The request has been cancelled and automatically approved for refund.'
        });
      }

      booking.status = status;
      await booking.save();

      await Booking.updateMany(
        { car: booking.car, _id: { $ne: booking._id }, status: 'pending' },
        {
          status: 'cancelled',
          refundStatus: 'approved',
          refundReason: 'Automatically refunded: another booking for this car was confirmed first.'
        }
      );

      await notifyUser(booking.user, 'Booking Confirmed', 'Your booking has been confirmed. Check My Bookings for details.', '/my-bookings');
      if (car.owner) {
        await notifyUser(car.owner, 'Vehicle Booked', `Your vehicle ${car.brand} ${car.model} has a new confirmed booking.`, '/consignor');
      }

      return res.json(booking);
    }

    booking.status = status;
    await booking.save();

    if ((status === 'cancelled' || status === 'completed') && previousStatus === 'confirmed') {
      await Car.findByIdAndUpdate(booking.car, { isAvailable: true });
    }

    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      await notifyUser(booking.user, 'Booking Cancelled', 'Your booking has been cancelled by our team.', '/my-bookings');
    }
    if (status === 'completed' && previousStatus !== 'completed') {
      await notifyUser(booking.user, 'Vehicle Returned', 'Your vehicle return has been recorded. You can now rate your experience.', '/my-bookings/rate');
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Client requests a refund
router.post('/:id/refund', protect, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking is not eligible for a refund.' });
    }
    if (booking.refundStatus !== 'none') {
      return res.status(400).json({ message: 'A refund request already exists for this booking.' });
    }

    booking.refundStatus = 'requested';
    booking.refundReason = reason;
    await booking.save();

    await notifyAdmins('New Refund Request', 'A client has requested a refund for a booking.', '/admin/manage-bookings');

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines a refund request
router.put('/:id/refund', protect, adminOnly, async (req, res) => {
  try {
    const { decision } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.refundStatus !== 'requested') {
      return res.status(400).json({ message: 'No pending refund request for this booking.' });
    }

    booking.refundStatus = decision;

    if (decision === 'approved') {
      const wasConfirmed = booking.status === 'confirmed';
      booking.status = 'cancelled';
      if (wasConfirmed) {
        await Car.findByIdAndUpdate(booking.car, { isAvailable: true });
      }
    }

    await booking.save();

    if (decision === 'approved') {
      await notifyUser(booking.user, 'Refund Approved', 'Your refund request has been approved.', '/my-bookings');
    } else if (decision === 'declined') {
      await notifyUser(booking.user, 'Refund Declined', 'Your refund request has been declined.', '/my-bookings');
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Client rates the car/service after the vehicle has been returned
router.post('/:id/rate-car', protect, async (req, res) => {
  try {
    const { vehicleCondition, serviceQuality, cleanliness, comment, photos } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'You can only rate this booking after the vehicle has been returned.' });
    }
    for (const val of [vehicleCondition, serviceQuality, cleanliness]) {
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return res.status(400).json({ message: 'All ratings must be a whole number between 1 and 5.' });
      }
    }

    const overall = Math.round(((vehicleCondition + serviceQuality + cleanliness) / 3) * 10) / 10;
    const ratedAt = booking.carRating?.ratedAt || new Date();

    booking.carRating = {
      vehicleCondition, serviceQuality, cleanliness, overall,
      comment: comment || '', photos: Array.isArray(photos) ? photos : [],
      ratedAt, updatedAt: new Date(),
    };
    await booking.save();
    await recomputeCarRating(booking.car);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin rates the client after the vehicle has been returned
router.post('/:id/rate-client', protect, adminOnly, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'You can only rate this client after the vehicle has been returned.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5.' });
    }

    const ratedAt = booking.clientRating?.ratedAt || new Date();

    booking.clientRating = { rating, comment: comment || '', ratedAt, updatedAt: new Date() };
    await booking.save();
    await recomputeClientRating(booking.user);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;