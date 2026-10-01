import express from 'express';
import Settings from '../models/Settings.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { deliverySettings, DEFAULTS } from '../utils/delivery.js';

const router = express.Router();

// What the booking form needs to quote a delivery: where we are, and what
// we charge. Public on purpose — it is the price list, and a customer is
// about to be shown every one of these numbers anyway. Nothing else from
// the settings document is exposed here.
router.get('/delivery', async (req, res) => {
  try {
    const saved = await Settings.current();
    res.json(deliverySettings(saved));
  } catch (err) {
    // A settings read must never take the booking form down with it: the
    // defaults are the system's real behaviour before anybody edits
    // anything, so serving them is correct rather than a fallback.
    console.error('Settings read failed, serving defaults:', err.message);
    res.json(deliverySettings(null));
  }
});

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    res.json(await Settings.current());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const asNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// Saved field by field rather than by spreading the body, so a request
// cannot introduce keys the schema never meant to hold, and so each number
// lands inside the range that keeps a quote sane. The same clamps live in
// utils/delivery.js for reading; doing it here too means a bad value is
// never stored in the first place.
router.put('/', protect, adminOnly, async (req, res) => {
  try {
    const current = await Settings.current();
    const { base, delivery } = req.body || {};

    if (base) {
      const lat = asNumber(base.lat, current.base.lat);
      const lng = asNumber(base.lng, current.base.lng);
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ message: 'That pin is not a place on earth. Please pick it again on the map.' });
      }
      current.base.label = String(base.label ?? current.base.label).trim().slice(0, 120);
      current.base.lat = lat;
      current.base.lng = lng;
    }

    if (delivery) {
      if (delivery.enabled !== undefined) current.delivery.enabled = !!delivery.enabled;
      current.delivery.freeKm = Math.max(0, asNumber(delivery.freeKm, current.delivery.freeKm));
      current.delivery.ratePerKm = Math.max(0, asNumber(delivery.ratePerKm, current.delivery.ratePerKm));
      current.delivery.maxKm = Math.max(0, asNumber(delivery.maxKm, current.delivery.maxKm));
      // Under 1 would say the road is shorter than the straight line, which
      // would have us quoting less than every drive actually costs.
      current.delivery.roadFactor = Math.max(1, asNumber(delivery.roadFactor, current.delivery.roadFactor));
      if (current.delivery.freeKm > current.delivery.maxKm) {
        return res.status(400).json({ message: 'The free distance cannot be further than the furthest you deliver.' });
      }
    }

    await current.save();
    res.json(current);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// What the form falls back to when admin clears a field, and what the
// "reset" button restores.
router.get('/defaults', protect, adminOnly, (req, res) => res.json(DEFAULTS));

export default router;
