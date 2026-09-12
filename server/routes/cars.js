import express from 'express';
import jwt from 'jsonwebtoken';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import { protect, adminOnly, consignorOnly, adminOrConsignor } from '../middleware/auth.js';
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
// Admin-blocked ranges are merged in the same way — from the client's side
// there's no difference between "someone else booked it" and "the admin
// blocked it", both just mean the date can't be picked.
router.get('/:id/booked-dates', async (req, res) => {
  try {
    const [bookings, car] = await Promise.all([
      Booking.find({ car: req.params.id, status: 'confirmed' }).select('startDate endDate'),
      Car.findById(req.params.id).select('blockedDates'),
    ]);
    const ranges = [
      ...bookings.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
      ...(car?.blockedDates || [])
        .filter((b) => b.status === 'approved')
        .map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
    ];
    res.json(ranges);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: block a date range immediately. Consignor (owning the vehicle):
// submits the same request, but it saves as 'pending' and needs admin
// approval before it actually affects availability — see
// PUT /:id/blocked-dates/:blockId/decision below. Either way, refuses if a
// confirmed booking already overlaps, since that would contradict an
// existing commitment rather than prevent one.
router.post('/:id/blocked-dates', protect, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const isOwner = car.owner && car.owner.toString() === req.user.id;
    const isConsignor = req.user.role === 'consignor' && isOwner;
    if (req.user.role !== 'admin' && !isConsignor) {
      return res.status(403).json({ message: 'You can only manage blocked dates for your own vehicles.' });
    }

    const { startDate, endDate, reason } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!startDate || !endDate || isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ message: 'Please provide a valid date range.' });
    }

    const conflictingBooking = await Booking.findOne({
      car: req.params.id, status: 'confirmed',
      startDate: { $lt: end }, endDate: { $gt: start },
    });
    if (conflictingBooking) {
      return res.status(400).json({ message: 'This vehicle already has a confirmed booking overlapping these dates.' });
    }

    car.blockedDates.push({
      startDate: start, endDate: end, reason: reason || '',
      status: isConsignor ? 'pending' : 'approved',
      requestedBy: isConsignor ? 'consignor' : 'admin',
    });
    await car.save();

    if (isConsignor) {
      await notifyAdmins('New Blocked Date Request', `A consignor requested to block dates on "${car.brand} ${car.model}".`, '/admin/availability-requests');
    }

    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines a consignor's pending blocked-date request
router.put('/:id/blocked-dates/:blockId/decision', protect, adminOnly, async (req, res) => {
  try {
    const { decision, adminNotes } = req.body;
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    const block = car.blockedDates.id(req.params.blockId);
    if (!block || block.status !== 'pending') {
      return res.status(400).json({ message: 'No pending request for this date range.' });
    }

    if (decision === 'approved') {
      const conflictingBooking = await Booking.findOne({
        car: car._id, status: 'confirmed',
        startDate: { $lt: block.endDate }, endDate: { $gt: block.startDate },
      });
      if (conflictingBooking) {
        return res.status(400).json({ message: 'This vehicle now has a confirmed booking overlapping these dates — decline instead.' });
      }
      block.status = 'approved';
      block.adminNotes = '';
    } else {
      block.status = 'declined';
      block.adminNotes = adminNotes || '';
    }
    await car.save();

    if (decision === 'approved') {
      await notifyUser(car.owner, 'Blocked Dates Approved', `Your blocked dates for "${car.brand} ${car.model}" have been approved.`, '/consignor');
    } else {
      await notifyUser(car.owner, 'Blocked Dates Declined', `Your blocked-date request for "${car.brand} ${car.model}" was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}`, '/consignor');
    }

    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List every car with at least one pending consignor blocked-date request
// (admin only) — flattened to one row per request since a car can have
// several pending ranges at once, unlike the single-slot availabilityRequest.
router.get('/blocked-date-requests', protect, adminOnly, async (req, res) => {
  try {
    const cars = await Car.find({ 'blockedDates.status': 'pending' }).populate('owner', 'name email');
    const requests = [];
    cars.forEach((car) => {
      car.blockedDates.forEach((block) => {
        if (block.status !== 'pending') return;
        requests.push({
          _id: block._id,
          carId: car._id,
          brand: car.brand,
          model: car.model,
          image: car.image,
          owner: car.owner,
          startDate: block.startDate,
          endDate: block.endDate,
          reason: block.reason,
        });
      });
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin, or the consignor who owns the vehicle: remove a blocked date range
router.delete('/:id/blocked-dates/:blockId', protect, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const isOwner = car.owner && car.owner.toString() === req.user.id;
    if (req.user.role !== 'admin' && !(req.user.role === 'consignor' && isOwner)) {
      return res.status(403).json({ message: 'You can only manage blocked dates for your own vehicles.' });
    }
    car.blockedDates = car.blockedDates.filter((b) => b._id.toString() !== req.params.blockId);
    await car.save();
    res.json(car);
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

// Cars for the homepage stacked carousel (public) — admin-picked cars if any
// exist, otherwise auto-falls back to the highest-rated listed cars so the
// carousel is never empty on a fresh install. Either way, only cars that are
// actually bookable right now (listed, not archived) are eligible.
router.get('/featured', async (req, res) => {
  try {
    const baseFilter = { archived: { $ne: true }, isAvailable: true };
    let cars = await Car.find({ ...baseFilter, featured: true }).limit(6);

    if (cars.length === 0) {
      cars = await Car.find({ ...baseFilter, ratingCount: { $gt: 0 } })
        .sort({ avgRating: -1, ratingCount: -1 })
        .limit(6);
    }

    if (getRequestRole(req) !== 'admin') {
      cars = cars.map(hidePlateNumber);
    }

    res.json(cars);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Legazpi City center — placeholder fleet positions (see mockGps below)
// are scattered around here until a real tracker reports in.
const LEGAZPI_LAT = 13.1391;
const LEGAZPI_LNG = 123.7438;

// No real device has reported for this car yet — derive a stable, spread-
// out placeholder position from its own id instead of a random one, so it
// doesn't jump around between requests or stack every car on one point.
// isMock lets the dashboard label these as "not yet connected".
function mockGps(carId) {
  const hash = parseInt(carId.toString().slice(-6), 16);
  const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.06;
  const lngOffset = (((hash >> 4) % 1000) / 1000 - 0.5) * 0.06;
  return {
    lat: LEGAZPI_LAT + latOffset,
    lng: LEGAZPI_LNG + lngOffset,
    speed: 0,
    ignitionOn: false,
    updatedAt: null,
    isMock: true,
  };
}

// Fleet positions for the GPS Tracking dashboard — admin sees every listed
// car, a consignor only their own. Cars whose tracker hasn't reported yet
// (gps.updatedAt is null) get a mockGps placeholder so the dashboard always
// has something to plot, clearly marked isMock for the UI to flag.
router.get('/gps-fleet', protect, adminOrConsignor, async (req, res) => {
  try {
    const filter = { archived: { $ne: true } };
    if (req.user.role === 'consignor') filter.owner = req.user.id;

    const cars = await Car.find(filter).select('brand model plateNumber image gps owner');

    // A car is "Rented" if it has a confirmed booking covering today, not
    // based on the tracker's own ignition signal — that tells us the
    // engine is running, not whether a customer actually has the car out,
    // and works the same whether or not a real tracker is connected yet.
    const now = new Date();
    const activeBookings = await Booking.find({
      car: { $in: cars.map((c) => c._id) },
      status: 'confirmed',
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select('car');
    const rentedCarIds = new Set(activeBookings.map((b) => b.car.toString()));

    const withGps = cars.map((car) => {
      const obj = req.user.role === 'admin' ? car.toObject() : hidePlateNumber(car);
      obj.gps = car.gps?.updatedAt ? { ...car.gps.toObject(), isMock: false } : mockGps(car._id);
      obj.isRented = rentedCarIds.has(car._id.toString());
      return obj;
    });

    res.json(withGps);
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

// Toggle whether a car appears in the homepage stacked carousel (admin only)
router.put('/:id/feature', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    car.featured = !car.featured;
    await car.save();
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
// Both directions (going unavailable AND coming back available) need admin
// sign-off — a consignor can't unilaterally pull a car off the platform or
// put it back into public listings without review.
router.put('/:id/toggle', protect, consignorOnly, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (!car.owner || car.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only manage your own vehicles' });
    }
    if (car.availabilityRequest?.status === 'pending') {
      return res.status(400).json({ message: 'You already have a pending request for this vehicle.' });
    }

    const requestType = car.isAvailable ? 'unavailable' : 'available';
    car.availabilityRequest = { status: 'pending', type: requestType, reason: req.body.reason || '', requestedAt: new Date(), adminNotes: '' };
    await car.save();
    await notifyAdmins('New Availability Request', `A consignor requested to mark "${car.brand} ${car.model}" ${requestType}.`, '/admin/availability-requests');
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin approves or declines a consignor's request to change their car's availability
router.put('/:id/availability-request', protect, adminOnly, async (req, res) => {
  try {
    const { decision, adminNotes } = req.body;
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    if (car.availabilityRequest?.status !== 'pending') {
      return res.status(400).json({ message: 'No pending request for this vehicle.' });
    }

    const requestType = car.availabilityRequest.type || 'unavailable';

    if (decision === 'approved') {
      car.isAvailable = requestType === 'available';
      car.availabilityRequest = { status: 'none', type: 'unavailable', reason: '', requestedAt: null, adminNotes: '' };
    } else {
      car.availabilityRequest.status = 'declined';
      car.availabilityRequest.adminNotes = adminNotes || '';
    }

    await car.save();

    if (decision === 'approved') {
      await notifyUser(car.owner, 'Availability Request Approved', `Your request to mark "${car.brand} ${car.model}" ${requestType} has been approved.`, '/consignor');
    } else {
      await notifyUser(car.owner, 'Availability Request Declined', `Your request to mark "${car.brand} ${car.model}" ${requestType} was declined.${adminNotes ? ` Reason: ${adminNotes}` : ''}`, '/consignor');
    }

    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;