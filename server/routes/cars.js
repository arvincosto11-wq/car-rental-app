import express from 'express';
import jwt from 'jsonwebtoken';
import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import { protect, adminOnly, consignorOnly, adminOrConsignor } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';
import { fetchAikaGps } from '../utils/aikaGps.js';
import { validatePromo } from '../utils/promo.js';
import { cancelBookingWithRefund, refundAmountFor, isUnderway } from '../utils/cancelBooking.js';
import { BLOCK_REASON_CODES, causeFor, blockLabelFor } from '../utils/blockReasons.js';
import { openAdjustOffer, previewAlternatives } from '../utils/adjustOffer.js';
import { bookingSpan, blockedSpan, padded, bookingsOverlapping, overlaps } from '../utils/availability.js';
import { instantFrom, isClockHour, formatMoment, turnaroundHoursFor } from '../utils/phTime.js';
import User from '../models/User.js';

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
    const role = getRequestRole(req);
    let cars = await Car.find({ archived: { $ne: true } });

    if (role !== 'admin') {
      cars = cars.filter((c) => c.status !== 'draft');
    }

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

    if (role !== 'admin') {
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
    // Admin picking promo dates also needs to see PENDING bookings, because
    // those trigger the overlap warning on PUT /:id/promo — a calendar that
    // showed a day as free and then warned about it would be lying. Customers
    // never get this: a pending request doesn't block anyone else's booking.
    const includePending =
      req.query.includePending === 'true' && getRequestRole(req) === 'admin';
    const statuses = includePending ? ['confirmed', 'pending'] : ['confirmed'];

    const [bookings, car] = await Promise.all([
      Booking.find({ car: req.params.id, status: { $in: statuses } }).select('startDate endDate hasPickupTime'),
      Car.findById(req.params.id).select('blockedDates turnaroundHours'),
    ]);

    // Each range carries BOTH forms. startDate/endDate are the raw stored
    // dates, which is all the admin date pickers ever needed. busyStart and
    // busyEnd are the real moments the vehicle can't be had — a booking's
    // own span plus the turnaround either side of it — so the client
    // calendar can grey out part of a changeover day instead of losing the
    // whole of it, and agrees with what the server will actually accept.
    const hours = turnaroundHoursFor(car);
    const ranges = [
      ...bookings.map((b) => {
        const busy = padded(bookingSpan(b), hours);
        return { startDate: b.startDate, endDate: b.endDate, busyStart: busy.start, busyEnd: busy.end, kind: 'booking' };
      }),
      ...(car?.blockedDates || [])
        .filter((b) => b.status === 'approved')
        .map((b) => {
          const busy = blockedSpan(b);
          return { startDate: b.startDate, endDate: b.endDate, busyStart: busy.start, busyEnd: busy.end, kind: 'block' };
        }),
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

    const { startDate, endDate, startHour, endHour, reasonCode, note } = req.body;
    // A block covers whole days unless admin gave it hours — "in for aircon
    // service 8:00 AM to 12:00 PM, back on the road in the afternoon".
    // Whole days run midnight to midnight in Legazpi, which is what they
    // always meant; storing them at UTC midnight put them eight hours out,
    // and that gap is exactly where a 7:00 AM pickup would slip through.
    const hasTime = isClockHour(startHour) && isClockHour(endHour);
    const start = instantFrom(startDate, hasTime ? Number(startHour) : 0);
    const end = instantFrom(endDate, hasTime ? Number(endHour) : 0);
    // A whole-day range now covers the last day the admin picked, which is
    // what the form has always asked for. Recorded on the range rather than
    // baked into the stored date, so older ranges keep their own meaning.
    const endsInclusive = !hasTime;
    if (!startDate || !endDate || isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ message: 'Please provide a valid date range.' });
    }

    // Blocking the same span twice adds a second range that does nothing —
    // the vehicle is already off the road for those days — and leaves a
    // confusing list to clean up. Declined ranges don't count; they never
    // took effect.
    const wanted = blockedSpan({ startDate: start, endDate: end, hasTime, endsInclusive });
    const clash = (car.blockedDates || []).find((b) => b.status !== 'declined'
      && overlaps(blockedSpan(b), wanted));
    if (clash) {
      const shown = (d) => formatMoment(d, clash.hasTime, { month: 'short', day: 'numeric', year: 'numeric' });
      return res.status(400).json({
        message: `These dates overlap a blocked range already on this vehicle (${shown(clash.startDate)} to ${shown(clash.endDate)}). `
          + 'Remove that one first, or pick different dates.',
      });
    }

    // A vehicle that breaks down has to come off the road even though people
    // have already booked it. Blocking used to just refuse, which left admin
    // stuck: unable to block, and with no way to cancel-and-refund either.
    //
    // Blocking and refunding are ONE action rather than two. Doing them
    // separately leaves a window where the dates are free again and someone
    // books the broken car, and it can be left half-done.
    // Queried a day wide either side and then compared precisely — bookings
    // made before pickup times existed are stored eight hours out, and a
    // tight range query would miss the ones at the edges.
    const affected = await bookingsOverlapping(req.params.id, wanted, ['confirmed', 'pending']);

    if (affected.length) {
      // A consignor can't cancel anyone's booking — that would let them move
      // admin's money. Their request comes to admin instead, as before.
      if (isConsignor) {
        return res.status(400).json({ message: 'This vehicle already has a booking overlapping these dates. Please contact admin.' });
      }

      // The client physically has the car, so cancelling behind their back
      // would be wrong. Reported, never touched.
      const underway = affected.filter((b) => isUnderway(b));
      const cancellable = affected.filter((b) => !isUnderway(b));

      // Required only when someone's booking is about to be cancelled. Being
      // made to justify blocking an empty week would just train admin to
      // click past it.
      if (!BLOCK_REASON_CODES.includes(reasonCode)) {
        return res.status(400).json({
          message: 'Please choose a reason — these dates have bookings, and the clients need to be told why.',
        });
      }

      if (!req.body.confirmCancellations) {
        // Whether each client can be offered other dates rather than simply
        // refunded, worked out with the range about to be blocked already
        // counted as taken. Nothing is saved — this is only so the dialog
        // can tell admin what is actually about to happen to each client.
        const offerable = await Promise.all(cancellable.map(async (b) =>
          (await previewAlternatives(b, { extra: [{ startDate: start, endDate: end, hasTime, endsInclusive }] })).length));

        return res.status(409).json({
          needsConfirmation: true,
          message: 'Blocking these dates affects the bookings below.',
          cancellable: cancellable.map((b, i) => ({
            id: b._id,
            client: b.user?.name || 'A client',
            startDate: b.startDate,
            endDate: b.endDate,
            totalDays: b.totalDays,
            status: b.status,
            refund: refundAmountFor(b, 'vehicle_unavailable'),
            // How many alternative dates this client can be offered. Zero
            // means nothing free nearby, or too close to pickup — those are
            // cancelled and refunded outright, as before.
            offerCount: offerable[i],
          })),
          underway: underway.map((b) => ({
            id: b._id,
            client: b.user?.name || 'A client',
            startDate: b.startDate,
            endDate: b.endDate,
          })),
        });
      }

      // Pulling the vehicle doesn't have to mean cancelling the trip. Each
      // client is offered the nearest dates we can still honour, against a
      // full refund, and has until the offer's deadline to choose — see
      // utils/adjustOffer.js. The range being blocked is passed in because
      // it isn't saved on the car yet, and dates inside it are obviously no
      // use as alternatives.
      //
      // When there's nothing to offer it falls back to cancelling with the
      // full amount refunded: the business pulled the vehicle, so this is
      // never the client's choice to cancel.
      for (const booking of cancellable) {
        const offered = await openAdjustOffer(booking, {
          reason: 'vehicle_unavailable',
          // The mapped, client-safe phrase — never the private note.
          cause: causeFor(reasonCode),
          extra: [{ startDate: start, endDate: end, hasTime, endsInclusive }],
        });
        if (offered) continue;

        await cancelBookingWithRefund(booking, {
          reason: 'vehicle_unavailable',
          cause: causeFor(reasonCode),
        });
      }
    }

    car.blockedDates.push({
      startDate: start, endDate: end, hasTime, endsInclusive,
      reasonCode: BLOCK_REASON_CODES.includes(reasonCode) ? reasonCode : '',
      note: note || '',
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
      const [conflictingBooking] = await bookingsOverlapping(car._id, blockedSpan(block), ['confirmed']);
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
          reason: blockLabelFor(block),
          note: block.note,
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
    let cars = await Car.find({ ...baseFilter, featured: true });
    cars = cars.filter((c) => c.status !== 'draft').slice(0, 6);

    if (cars.length === 0) {
      const fallback = await Car.find({ ...baseFilter, ratingCount: { $gt: 0 } })
        .sort({ avgRating: -1, ratingCount: -1 });
      cars = fallback.filter((c) => c.status !== 'draft').slice(0, 6);
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

    const cars = await Car.find(filter).select('brand model plateNumber image gps gpsDeviceId owner');

    // Any car with a physical tracker assigned gets a live pull before we
    // respond — one HTTP round trip to AIKA per tracker, fine at this
    // scale (an admin/consignor dashboard load, not a high-traffic path).
    // Isolated per car so one tracker/account hiccup doesn't take down the
    // whole fleet view; a failure just leaves that car on its last known
    // (or mock) position for this load.
    const trackedCars = cars.filter((c) => c.gpsDeviceId);
    if (!process.env.AIKA_PASSWORD) {
      if (trackedCars.length) console.log(`AIKA: ${trackedCars.length} car(s) have a gpsDeviceId set, but AIKA_PASSWORD isn't configured — skipping live fetch.`);
    } else if (trackedCars.length === 0) {
      console.log('AIKA: AIKA_PASSWORD is set, but no car has a gpsDeviceId assigned yet.');
    } else {
      await Promise.all(trackedCars.map(async (car) => {
        console.log(`AIKA: fetching live position for ${car.brand} ${car.model} (car ${car._id}, device ${car.gpsDeviceId})...`);
        try {
          const live = await fetchAikaGps(car.gpsDeviceId, process.env.AIKA_PASSWORD);
          // null means the tracker hasn't gotten a real GPS fix yet (its
          // own "no data" sentinel) — leave the car's existing gps (mock
          // or last known good fix) alone rather than overwrite it.
          if (live) {
            car.gps = live;
            await car.save();
            console.log(`AIKA: got a real fix for car ${car._id} — lat ${live.lat}, lng ${live.lng}.`);
          } else {
            console.log(`AIKA: car ${car._id}'s tracker reported no GPS fix yet — keeping its previous position.`);
          }
        } catch (err) {
          console.error(`AIKA: fetch FAILED for car ${car._id} (device ${car.gpsDeviceId}):`, err.message);
        }
      }));
    }

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
    const role = getRequestRole(req);
    if (car.status === 'draft' && role !== 'admin') return res.status(404).json({ message: 'Car not found' });
    res.json(role === 'admin' ? car : hidePlateNumber(car));
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
    // An absurd turnaround would quietly take the vehicle off the market
    // around every booking, so it's bounded here rather than trusted from
    // the form. Blank clears it back to the standard two hours.
    if ('turnaroundHours' in req.body) {
      const raw = req.body.turnaroundHours;
      if (raw === '' || raw === null || raw === undefined) {
        req.body.turnaroundHours = null;
      } else {
        const hours = Number(raw);
        if (!Number.isInteger(hours) || hours < 0 || hours > 48) {
          return res.status(400).json({ message: 'Turnaround must be a whole number of hours from 0 to 48, or left blank for the standard 2.' });
        }
        req.body.turnaroundHours = hours;
      }
    }

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

// Set or replace this vehicle's promo (admin only — a consignor can never
// discount their own car, since it's admin who carries the cost).
//
// Overlapping bookings are a WARNING, not a block: one booking mid-week
// would otherwise make a promo impossible on exactly the cars that book
// most. The first call reports the clash, and the client re-sends with
// confirmOverlap once admin has seen it.
router.put('/:id/promo', protect, adminOnly, async (req, res) => {
  try {
    const { label, type, value, startDate, endDate, confirmOverlap } = req.body;
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    const problem = validatePromo({ label, type, value, startDate, endDate }, car);
    if (problem) return res.status(400).json({ message: problem });

    const windowStart = new Date(startDate);
    const windowEnd = new Date(endDate);
    windowEnd.setUTCHours(23, 59, 59, 999);

    if (!confirmOverlap) {
      // Pending counts the same as confirmed here: the client has already
      // paid, so they'd be the one who missed out on the discount.
      const clashes = await Booking.find({
        car: car._id,
        status: { $in: ['pending', 'confirmed'] },
        startDate: { $lt: windowEnd },
        endDate: { $gt: windowStart },
      }).select('startDate endDate').sort({ startDate: 1 });

      if (clashes.length) {
        return res.status(409).json({
          needsConfirmation: true,
          message: 'Some of those dates are already booked. Those bookings keep the price they were made at.',
          clashes: clashes.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
        });
      }
    }

    // Only a genuinely different offer is worth notifying about — fixing a
    // typo in the label shouldn't ping everyone a second time.
    const before = car.promo;
    const sameOffer = !!(
      before?.startDate &&
      before.type === type &&
      Number(before.value) === Number(value) &&
      new Date(before.startDate).getTime() === windowStart.getTime() &&
      new Date(before.endDate).getTime() === new Date(endDate).getTime()
    );

    car.promo = {
      label: label.trim(),
      type,
      value: Number(value),
      startDate: windowStart,
      endDate: new Date(endDate),
      createdAt: new Date(),
    };
    await car.save();

    if (!sameOffer) {
      // Favourites are an array of car ids on the user, so this is one lookup.
      const offer = type === 'percent' ? `${value}% off` : `₱${Number(value).toLocaleString()} off`;
      const fans = await User.find({ favorites: car._id }).select('_id');
      for (const fan of fans) {
        await notifyUser(
          fan._id,
          `${car.promo.label}: ${car.brand} ${car.model}`,
          `${offer} the ${car.brand} ${car.model} — book dates inside the promo to save.`,
          `/cars/${car._id}`
        );
      }
    }

    res.json(car);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clear the promo (admin only). Safe at any time — bookings already made
// under it keep their own stored price and label.
router.delete('/:id/promo', protect, adminOnly, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    car.promo = undefined;
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
    // A draft was never public, so nobody can have booked or reviewed it —
    // there's no history for archiving to preserve, and it can go straight
    // away. Anything that has been live must be archived first. The
    // bookings check below still applies to both, as a backstop.
    if (!car.archived && car.status !== 'draft') {
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