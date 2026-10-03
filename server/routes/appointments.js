import express from 'express';
import Appointment from '../models/Appointment.js';
import Car from '../models/Car.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import { protect, adminOnly, consignorOnly } from '../middleware/auth.js';
import { notifyUser, notifyAdmins } from '../utils/notify.js';
import { openSlots, slotProblem, appointmentSettings, slotLabel, vehicleNoteProblem } from '../utils/appointments.js';

const router = express.Router();

// Slots already spoken for. Only a booked one holds a time — a cancelled or
// missed appointment gives it back, which is the same rule the unique index
// in models/Appointment.js enforces.
const takenSlots = async (from = new Date()) => {
  const rows = await Appointment.find({ status: 'booked', at: { $gte: from } }).select('at').lean();
  return rows.map((r) => r.at);
};

// What somebody can pick. Public to a logged-in consignor; there is nothing
// sensitive in a list of free times, but there is no reason to publish the
// opening calendar to the whole internet either.
router.get('/slots', protect, async (req, res) => {
  try {
    const settings = await Settings.current();
    const slots = openSlots(settings, { taken: await takenSlots() });
    res.json({
      settings: appointmentSettings(settings),
      // Grouped by day, because that is how somebody picks: a date first,
      // then a time within it.
      days: slots.reduce((acc, slot) => {
        const day = acc.find((d) => d.day === slot.day);
        if (day) day.times.push({ at: slot.at, label: slot.label });
        else acc.push({ day: slot.day, times: [{ at: slot.at, label: slot.label }] });
        return acc;
      }, []),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/mine', protect, async (req, res) => {
  try {
    res.json(await Appointment.find({ owner: req.user.id }).sort({ at: -1 }).lean());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Booking one.
//
// The slot is re-checked here rather than trusted from the page, which may
// have been open for an hour. Even so the unique index is what actually
// decides it: two people pressing Book in the same second both pass this
// check, and only one of them gets the row.
router.post('/', protect, consignorOnly, async (req, res) => {
  try {
    // Checked here as well as in the form, because the form is a courtesy
    // and this is the gate. See utils/appointments.js for what it can and
    // cannot tell.
    const noteProblem = vehicleNoteProblem(req.body);
    if (noteProblem) return res.status(400).json({ message: noteProblem });

    const settings = await Settings.current();
    const problem = slotProblem(req.body.at, settings, { taken: await takenSlots() });
    if (problem) return res.status(400).json({ message: problem });

    // One at a time. Somebody with three vehicles books the next one after
    // this visit, which is also the only way we know the first went well.
    const existing = await Appointment.findOne({ owner: req.user.id, status: 'booked' });
    if (existing) {
      return res.status(400).json({ message: 'You already have an appointment booked. Please keep or cancel that one first.' });
    }

    const appointment = await Appointment.create({
      owner: req.user.id,
      at: new Date(req.body.at),
      vehicle: {
        brand: String(req.body.brand || '').trim().slice(0, 60),
        model: String(req.body.model || '').trim().slice(0, 60),
        year: Number(req.body.year) || undefined,
        note: String(req.body.note || '').trim().slice(0, 300),
      },
    });

    const who = await User.findById(req.user.id).select('name').lean();
    await notifyAdmins(
      'New inspection appointment',
      `${who?.name || 'A vehicle owner'} is bringing a ${appointment.vehicle.brand} ${appointment.vehicle.model} in on `
      + `${appointment.at.toDateString()} at ${slotLabel(appointment.at)}.`,
      '/admin/appointments',
    );
    res.status(201).json(appointment);
  } catch (err) {
    // The unique index speaking: somebody took the slot between the check
    // above and the write.
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Somebody has just taken that time. Please pick another.' });
    }
    res.status(500).json({ message: err.message });
  }
});

// Calling one off. Theirs to cancel while it is still ahead of them; after
// that it is admin's to mark as missed.
router.delete('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (String(appointment.owner) !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (appointment.status !== 'booked') {
      return res.status(400).json({ message: 'That appointment is already closed.' });
    }
    appointment.status = 'cancelled';
    appointment.closedAt = new Date();
    await appointment.save();
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- admin -----------------------------------------------------------------

router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const rows = await Appointment.find()
      .populate('owner', 'name email phone address')
      .sort({ at: 1 })
      .lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Closing one off: they came and it passed, they came and it did not, or
// they never came.
//
// Passing does NOT create the vehicle. Admin types that in Manage Cars with
// the vehicle in front of them, which is the whole point of the visit — and
// a half-filled listing created automatically here would be a worse start
// than no listing at all.
router.put('/:id/outcome', protect, adminOnly, async (req, res) => {
  try {
    const { outcome } = req.body;
    if (!['passed', 'failed', 'missed'].includes(outcome)) {
      return res.status(400).json({ message: 'Say whether it passed, failed, or was missed.' });
    }
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.status !== 'booked') {
      return res.status(400).json({ message: 'That appointment is already closed.' });
    }

    appointment.status = outcome;
    appointment.outcomeNote = String(req.body.note || '').trim().slice(0, 300);
    appointment.closedAt = new Date();
    await appointment.save();

    const messages = {
      passed: 'Your vehicle passed its check. We are setting up its listing now — it will appear on your dashboard shortly.',
      failed: `Your vehicle wasn't approved this time${appointment.outcomeNote ? `: ${appointment.outcomeNote}` : '.'} `
        + 'You can book another appointment once it is sorted.',
      missed: 'You missed your appointment. You can book another one whenever you are ready.',
    };
    await notifyUser(
      appointment.owner,
      outcome === 'passed' ? 'Vehicle approved' : outcome === 'failed' ? 'Vehicle not approved' : 'Appointment missed',
      messages[outcome],
      '/consignor',
      { email: true },
    );

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Which stage of the consignor journey somebody is on.
//
// Derived from whether they own a listed vehicle rather than stored as a
// flag. A flag would be a second source of truth to keep in step with the
// vehicles themselves, and it would be wrong the moment admin added or
// archived one.
router.get('/stage', protect, async (req, res) => {
  try {
    const vehicles = await Car.countDocuments({ owner: req.user.id, archived: { $ne: true } });
    const appointment = await Appointment.findOne({ owner: req.user.id, status: 'booked' }).lean();
    const last = await Appointment.findOne({ owner: req.user.id }).sort({ at: -1 }).lean();
    res.json({
      stage: vehicles > 0 ? 'consignor' : 'applicant',
      vehicles,
      booked: appointment || null,
      last: last || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
