import express from 'express';
import jwt from 'jsonwebtoken';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';

const router = express.Router();

// Best-effort role check for routes that stay public but still need to
// show more to a logged-in admin (e.g. plate numbers) — never rejects the
// request, just returns null if there's no/invalid token.
function getRequestRole(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).role;
  } catch {
    return null;
  }
}

// Plate number is confidential — only admin ever sees it. Consignors get
// it from their own Consignment record instead, not from the live Car.
function hidePlateNumber(car) {
  const obj = car.toObject ? car.toObject() : { ...car };
  delete obj.plateNumber;
  return obj;
}

// Get all cars (public) — archived cars are excluded everywhere they'd
// normally show up, including the admin's own Manage Cars list, which uses
// this same endpoint. See /archived below for the admin-only archived view.
// Optional startDate/endDate narrows the list to vehicles with no confirmed
// booking overlapping that range — used by the Cars/Home date search.
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let cars = await Car.find({ archived: { $ne: true } });

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const overlapping = await Booking.find({
        status: 'confirmed',
        startDate: { $lt: end },
        endDate: { $gt: start },
      }).select('car');
      const bookedCarIds = new Set(overlapping.map((b) => b.car.toString()));
      cars = cars.filter((c) => !bookedCarIds.has(c._id.toString()));
    }

    if (getRequestRole(req) !== 'admin') {
      cars = cars.map(hidePlateNumber);
    }

    res.json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Archived cars (admin only)
router.get('/archived', protect, adminOnly, async (req, res) => {
  try {
    const cars = await Car.find({ archived: true }).sort({ archivedAt: -1 });
    res.json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public: confirmed booking date ranges for a car, so clients can see which
// dates are already taken before booking. Only start/end dates are exposed —
// no renter identity or booking details, since this is publicly reachable.
router.get('/:id/booked-dates', async (req, res) => {
  try {
    const bookings = await Booking.find({ car: req.params.id, status: 'confirmed' })
      .select('startDate endDate');
    res.json(bookings.map((b) => ({ startDate: b.startDate, endDate: b.endDate })));
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

// All reviews across every car, for admin moderation — unlike the public
// per-car endpoint below, this is not masked (admin already has full client
// records elsewhere) and includes hidden reviews so they can be un-hidden.
router.get('/reviews/all', protect, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find({ 'carRating.ratedAt': { $exists: true } })
      .populate('user', 'name email')
      .populate('car', 'brand model image')
      .sort({ 'carRating.ratedAt': -1 })
      .select('carRating user car');

    const reviews = bookings.map((b) => ({
      _id: b._id,
      reviewerName: b.user?.name || 'Unknown',
      reviewerEmail: b.user?.email || '',
      car: b.car ? { _id: b.car._id, brand: b.car.brand, model: b.car.model, image: b.car.image } : null,
      vehicleCondition: b.carRating.vehicleCondition,
      serviceQuality: b.carRating.serviceQuality,
      cleanliness: b.carRating.cleanliness,
      overall: b.carRating.overall,
      comment: b.carRating.comment,
      photos: b.carRating.photos || [],
      hidden: !!b.carRating.hidden,
      ratedAt: b.carRating.ratedAt,
    }));

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public: a handful of the best-rated, commented reviews across all cars,
// for homepage testimonials. Reviewer name is masked the same way as the
// per-car reviews endpoint below.
router.get('/reviews/featured', async (req, res) => {
  try {
    const bookings = await Booking.find({
      'carRating.ratedAt': { $exists: true },
      'carRating.hidden': { $ne: true },
      'carRating.overall': { $gte: 4 },
      'carRating.comment': { $nin: [null, ''] },
    })
      .populate('user', 'name')
      .populate('car', 'brand model image')
      .sort({ 'carRating.overall': -1, 'carRating.ratedAt': -1 })
      .limit(6)
      .select('carRating user car');

    const reviews = bookings.map((b) => ({
      _id: b._id,
      reviewerName: maskReviewerName(b.user?.name),
      car: b.car ? { _id: b.car._id, brand: b.car.brand, model: b.car.model, image: b.car.image } : null,
      overall: b.carRating.overall,
      comment: b.carRating.comment,
      ratedAt: b.carRating.ratedAt,
    }));

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single car (public)
router.get('/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car || car.archived) return res.status(404).json({ message: 'Car not found' });
    res.json(getRequestRole(req) === 'admin' ? car : hidePlateNumber(car));
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
    const bookings = await Booking.find({ car: req.params.id, 'carRating.ratedAt': { $exists: true }, 'carRating.hidden': { $ne: true } })
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

// Archive a car (admin only) — removes it from every public/admin listing
// without deleting anything; fully recoverable via /restore below. Unlike
// permanent deletion, this is safe on a car with booking/rating history.
router.put('/:id/archive', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Restore an archived car (admin only)
router.put('/:id/restore', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { archived: false, archivedAt: null },
      { new: true }
    );
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Permanently delete a car (admin only). Only allowed once a car is already
// archived (a deliberate second step, not reachable from the main list) and
// only if it has no booking history, since that would orphan real data.
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (!car.archived) {
      return res.status(400).json({ message: 'Archive this car first before deleting it permanently.' });
    }
    const hasBookings = await Booking.exists({ car: req.params.id });
    if (hasBookings) {
      return res.status(400).json({ message: 'This car has existing bookings and cannot be permanently deleted.' });
    }
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: 'Car permanently deleted' });
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