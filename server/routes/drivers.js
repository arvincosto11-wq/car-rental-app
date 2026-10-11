import express from 'express';
import Driver from '../models/Driver.js';
import Booking from '../models/Booking.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { driverProblem, tidyName, tidyPhone, isWorking, publicDriver, driverFreeFor } from '../utils/drivers.js';
import { bookingSpan } from '../utils/availability.js';
import { instantFrom, addDays } from '../utils/phTime.js';

const router = express.Router();

// Every confirmed trip each driver is already on, as { driverId: [spans] }.
//
// Confirmed only. A pending request does not hold a driver, exactly as it
// does not hold the vehicle — see utils/drivers.js.
export async function driverTrips(ignoreBookingId = null) {
  const rows = await Booking.find({
    status: 'confirmed',
    driver: { $ne: null },
    ...(ignoreBookingId ? { _id: { $ne: ignoreBookingId } } : {}),
  }).select('driver startDate endDate hasPickupTime').lean();

  const byDriver = new Map();
  for (const row of rows) {
    const key = String(row.driver);
    if (!byDriver.has(key)) byDriver.set(key, []);
    byDriver.get(key).push({ ...bookingSpan(row), kind: 'trip' });
  }
  return byDriver;
}

// Everything that makes a driver unavailable, trips and days off together,
// as { driverId: [spans] }.
//
// One answer rather than two, because every caller wants the same thing:
// can this person do these dates. A rota that only looked at trips would
// cheerfully book somebody who is in hospital.
export async function driverBusy(ignoreBookingId = null) {
  const [trips, drivers] = await Promise.all([
    driverTrips(ignoreBookingId),
    Driver.find().select('blocks').lean(),
  ]);
  for (const driver of drivers) {
    const key = String(driver._id);
    if (!trips.has(key)) trips.set(key, []);
    for (const block of driver.blocks || []) {
      trips.get(key).push({ start: new Date(block.start), end: new Date(block.end), kind: 'off' });
    }
  }
  return trips;
}

// Who a customer can choose for these dates.
//
// Names only, never numbers — this is reachable by anybody with an account
// and it is read straight into a booking page. See publicDriver.
//
// An empty list is a legitimate answer and the booking form says so rather
// than hiding the option: somebody can still book and leave it to us.
router.get('/available', protect, async (req, res) => {
  try {
    const { start, end } = req.query;
    const span = { start: new Date(start), end: new Date(end) };
    if (Number.isNaN(span.start.getTime()) || Number.isNaN(span.end.getTime()) || span.end <= span.start) {
      return res.status(400).json({ message: 'Please choose your dates first.' });
    }

    const [drivers, busy] = await Promise.all([Driver.find().lean(), driverBusy()]);
    res.json(
      drivers
        .filter(isWorking)
        .filter((d) => driverFreeFor(span, busy.get(String(d._id)) || []))
        .map(publicDriver)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// The office's own list: names, numbers, who is working.
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    res.json(await Driver.find().sort({ active: -1, name: 1 }).lean());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    // Checked here as well as in the form, because the form is a courtesy
    // and this is the gate. See utils/drivers.js.
    const problem = driverProblem(req.body);
    if (problem) return res.status(400).json({ message: problem });

    const driver = await Driver.create({
      name: tidyName(req.body.name),
      phone: tidyPhone(req.body.phone),
      image: String(req.body.image || ''),
      imageFileId: String(req.body.imageFileId || ''),
      note: String(req.body.note || '').trim().slice(0, 300),
    });
    res.status(201).json(driver);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Somebody with that number is already on the list.' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    // Working or not is its own switch, and the only field that can be
    // changed on its own — the toggle in the list sends nothing else.
    if (req.body.active !== undefined && req.body.name === undefined && req.body.phone === undefined) {
      driver.active = !!req.body.active;
      await driver.save();
      return res.json(driver);
    }

    const problem = driverProblem(req.body);
    if (problem) return res.status(400).json({ message: problem });

    driver.name = tidyName(req.body.name);
    driver.phone = tidyPhone(req.body.phone);
    // Left out entirely means "unchanged"; an empty string means "taken
    // off". A photo that vanished because the form did not send the field
    // would be a photo somebody has to upload twice.
    if (req.body.image !== undefined) {
      driver.image = String(req.body.image || '');
      driver.imageFileId = String(req.body.imageFileId || '');
    }
    if (req.body.note !== undefined) driver.note = String(req.body.note || '').trim().slice(0, 300);
    if (req.body.active !== undefined) driver.active = !!req.body.active;
    await driver.save();
    res.json(driver);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Somebody with that number is already on the list.' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Every review anybody has left about a driver, newest first.
//
// Read off the bookings rather than kept on the driver, for the same reason
// the trips are: one copy of the truth. The driver only carries the average
// worked out from these.
//
// Hidden ones are included: this is the screen somebody un-hides from.
router.get('/reviews', protect, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find({ 'driverRating.ratedAt': { $exists: true } })
      .populate('user', 'name email')
      .populate('car', 'brand model')
      .populate('driverRating.driver', 'name image')
      .sort({ 'driverRating.ratedAt': -1 })
      .select('driverRating user car')
      .lean();

    res.json(bookings.map((b) => ({
      _id: b._id,
      driver: b.driverRating.driver
        ? { _id: b.driverRating.driver._id, name: b.driverRating.driver.name, image: b.driverRating.driver.image }
        : null,
      reviewerName: b.user?.name || 'Unknown',
      reviewerEmail: b.user?.email || '',
      car: b.car ? `${b.car.brand} ${b.car.model}` : '',
      rating: b.driverRating.rating,
      comment: b.driverRating.comment || '',
      hidden: !!b.driverRating.hidden,
      ratedAt: b.driverRating.ratedAt,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// One driver's diary: the trips they are on and the days they are off.
//
// Trips are read from the bookings rather than copied onto the driver, so
// this cannot disagree with Manage Bookings about who is driving what.
router.get('/:id/calendar', protect, adminOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).lean();
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const bookings = await Booking.find({ driver: driver._id, status: { $in: ['confirmed', 'completed'] } })
      .select('startDate endDate hasPickupTime status car user')
      .populate('car', 'brand model')
      .populate('user', 'name')
      .sort({ startDate: 1 })
      .lean();

    res.json({
      driver: { _id: driver._id, name: driver.name, image: driver.image, active: driver.active },
      blocks: driver.blocks || [],
      trips: bookings.map((b) => ({
        _id: b._id,
        ...bookingSpan(b),
        status: b.status,
        car: b.car ? `${b.car.brand} ${b.car.model}` : 'Vehicle',
        customer: b.user?.name || 'Client',
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Marking a driver off for some days.
//
// Whole Philippine days: somebody who is sick is sick for the day, not
// from 14:00. The end date is inclusive — "off the 12th to the 14th"
// means they are back on the 15th — because that is what somebody means
// when they say it out loud, and storing it as the following midnight
// makes every later comparison plain arithmetic.
router.post('/:id/blocks', protect, adminOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ message: 'Please choose the first and last day.' });
    // Both arrive as YYYY-MM-DD, which is already a Philippine calendar
    // day, so they are read as one rather than parsed as an instant and
    // shifted — the bug that costs a day in every timezone ahead of UTC.
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (!ymd.test(startDate) || !ymd.test(endDate)) {
      return res.status(400).json({ message: 'Those dates do not look right. Please pick them again.' });
    }
    const start = instantFrom(startDate, 0);
    const end = addDays(instantFrom(endDate, 0), 1);
    if (end <= start) return res.status(400).json({ message: 'The last day cannot be before the first.' });

    // A trip already promised to a customer is not something to paper over
    // by marking somebody off. Refused, with the clash named, so whoever is
    // doing this moves the booking first and knows which one.
    const clash = await Booking.find({ driver: driver._id, status: 'confirmed' })
      .select('startDate endDate hasPickupTime')
      .populate('user', 'name')
      .lean();
    const hit = clash.find((b) => {
      const span = bookingSpan(b);
      return span.start < end && span.end > start;
    });
    if (hit) {
      return res.status(400).json({
        message: `${driver.name} is already driving ${hit.user?.name || 'a client'} on `
          + `${new Date(hit.startDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}. `
          + 'Move that booking to another driver first.',
      });
    }

    driver.blocks.push({ start, end, reason: String(req.body.reason || '').trim().slice(0, 200) });
    await driver.save();

    // Saved, and now say what it has cost. These are warnings rather than
    // refusals on purpose: somebody being ill is a fact, not a request, and
    // a system that would not let you write it down would be lying about
    // the rota to keep its own books tidy. But finding out on the morning
    // is worse than finding out now.
    const overlapping = (b) => {
      const span = bookingSpan(b);
      return span.start < end && span.end > start;
    };
    const when = (b) => new Date(b.startDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });

    const [asked, unassigned, allDrivers] = await Promise.all([
      // Somebody asked for this driver by name and is still waiting for an
      // answer. Their request is not lost, but it cannot be honoured as it
      // stands, and whoever accepts it needs to know before they do.
      Booking.find({ driver: driver._id, status: 'pending' }).select('startDate endDate hasPickupTime user').populate('user', 'name').lean(),
      // A trip that needs a driver and has not got one yet.
      Booking.find({ status: { $in: ['pending', 'confirmed'] }, bookingType: 'with-driver', driver: null })
        .select('startDate endDate hasPickupTime status user').populate('user', 'name').lean(),
      Driver.find().lean(),
    ]);

    const warnings = [];
    for (const b of asked.filter(overlapping)) {
      warnings.push(`${b.user?.name || 'A client'} asked for ${driver.name} on ${when(b)}. That request needs another driver now.`);
    }

    // Read fresh, so the block just saved is counted: the question is who
    // is left, not who was free a moment ago.
    const busy = await driverBusy();
    for (const b of unassigned.filter(overlapping)) {
      const span = bookingSpan(b);
      const anyoneLeft = allDrivers
        .filter(isWorking)
        .some((d) => driverFreeFor(span, busy.get(String(d._id)) || []));
      if (!anyoneLeft) {
        warnings.push(`Nobody is left to drive ${b.user?.name || 'a client'} on ${when(b)}.`);
      }
    }

    res.status(201).json({ driver, warnings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id/blocks/:blockId', protect, adminOnly, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    const before = driver.blocks.length;
    driver.blocks = driver.blocks.filter((b) => String(b._id) !== req.params.blockId);
    if (driver.blocks.length === before) return res.status(404).json({ message: 'Those days are not blocked.' });
    await driver.save();
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Removing one for good.
//
// Rare, and usually the wrong thing: a driver who has left is still the
// driver on last month's bookings, and deleting the record would leave
// those naming nobody. "Not working" is what somebody leaving should
// normally produce, which is why that is the button on the list and this
// sits behind a confirmation.
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    res.json({ message: 'Driver removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
