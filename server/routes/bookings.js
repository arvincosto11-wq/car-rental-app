import express from 'express';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Create booking
router.post('/', protect, async (req, res) => {
  try {
    const { carId, startDate, endDate, location, paymentType, amountPaid, totalPrice } = req.body;
    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    if (!car.isAvailable) {
      return res.status(400).json({ message: 'This car is currently unavailable.' });
    }

    const existing = await Booking.findOne({
      user: req.user.id,
      car: carId,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have an active booking request for this car.' });
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
      location
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
      .populate('user', 'name email')
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
    booking.status = status;
    await booking.save();

    if (status === 'confirmed' && previousStatus !== 'confirmed') {
      // Car is now booked — mark it unavailable and auto-reject other pending requests for it
      await Car.findByIdAndUpdate(booking.car, { isAvailable: false });
      await Booking.updateMany(
        { car: booking.car, _id: { $ne: booking._id }, status: 'pending' },
        { status: 'cancelled' }
      );
    }

    if ((status === 'cancelled' || status === 'completed') && previousStatus === 'confirmed') {
      // Freeing the car back up
      await Car.findByIdAndUpdate(booking.car, { isAvailable: true });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;