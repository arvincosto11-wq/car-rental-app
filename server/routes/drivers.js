import express from 'express';
import Driver from '../models/Driver.js';
import Booking from '../models/Booking.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { driverProblem, tidyName, tidyPhone, isWorking, publicDriver, driverFreeFor } from '../utils/drivers.js';
import { bookingSpan } from '../utils/availability.js';

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
    byDriver.get(key).push(bookingSpan(row));
  }
  return byDriver;
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

    const [drivers, trips] = await Promise.all([Driver.find().lean(), driverTrips()]);
    res.json(
      drivers
        .filter(isWorking)
        .filter((d) => driverFreeFor(span, trips.get(String(d._id)) || []))
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
