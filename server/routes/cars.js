import express from 'express';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';

const router = express.Router();

// Get all cars (public)
router.get('/', async (req, res) => {
  try {
    const cars = await Car.find();
    res.json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List cars with a pending unavailability request (admin)
router.get('/availability-requests', protect, adminOnly, async (req, res) => {
  try {
    const cars = await Car.find({ 'availabilityRequest.status': 'pending' }).populate('owner', 'name email');
    res.json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single car (public)
router.get('/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Censor a reviewer's name down to their first initial (e.g. "John123" ->
// "J****"). Done server-side so the real name never reaches the browser.
const maskReviewerName = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'A****';
  return `${trimmed.charAt(0).toUpperCase()}****`;
};

// Public reviews for a car, pulled from client ratings left after a booking
router.get('/:id/reviews', async (req, res) => {
  try {
    const bookings = await Booking.find({ car: req.params.id, 'carRating.ratedAt': { $exists: true } })
      .populate('user', 'name')
      .sort({ 'carRating.ratedAt': -1 })
      .select('carRating user');

    const reviews = bookings.map((b) => ({
      _id: b._id,
      reviewerName: maskReviewerName(b.user?.name),
      vehicleCondition: b.carRating.vehicleCondition,
      serviceQuality: b.carRating.serviceQuality,
      cleanliness: b.carRating.cleanliness,
      overall: b.carRating.overall,
      comment: b.carRating.comment,
      photos: b.carRating.photos || [],
      ratedAt: b.carRating.ratedAt,
    }));

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add car (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.create(req.body);
    res.status(201).json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update car (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete car (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const hasBookings = await Booking.exists({ car: req.params.id });
    if (hasBookings) {
      return res.status(400).json({ message: 'This car has existing bookings and cannot be deleted. Hide it instead using the availability toggle.' });
    }
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: 'Car deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle availability for a car the logged-in consignor owns.
// Going unavailable requires admin approval; re-listing as available is instant.
router.put('/:id/toggle', protect, consignorOnly, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (!car.owner || car.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only manage your own vehicles' });
    }

    if (car.isAvailable) {
      if (car.availabilityRequest?.status === 'pending') {
        return res.status(400).json({ message: 'You already have a pending request for this vehicle.' });
      }
      car.availabilityRequest = { status: 'pending', reason: req.body.reason || '', requestedAt: new Date(), adminNotes: '' };
      await car.save();
      await notifyAdmins('New Availability Request', `A consignor requested to mark "${car.brand} ${car.model}" unavailable.`, '/admin/availability-requests');
      return res.json(car);
    } else {
      car.isAvailable = true;
      car.availabilityRequest = { status: 'none', reason: '', requestedAt: null, adminNotes: '' };
    }

    await car.save();
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines a consignor's request to make their car unavailable
router.put('/:id/availability-request', protect, adminOnly, async (req, res) => {
  try {
    const { decision, adminNotes } = req.body;
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (car.availabilityRequest?.status !== 'pending') {
      return res.status(400).json({ message: 'No pending request for this vehicle.' });
    }

    if (decision === 'approved') {
      car.isAvailable = false;
      car.availabilityRequest.status = 'none';
      car.availabilityRequest.adminNotes = '';
    } else {
      car.availabilityRequest.status = 'declined';
      car.availabilityRequest.adminNotes = adminNotes || '';
    }

    await car.save();

    if (decision === 'approved') {
      await notifyUser(car.owner, 'Availability Request Approved', `Your request to mark "${car.brand} ${car.model}" unavailable has been approved.`, '/consignor');
    } else {
      await notifyUser(car.owner, 'Availability Request Declined', `Your request to mark "${car.brand} ${car.model}" unavailable was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}`, '/consignor');
    }

    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;