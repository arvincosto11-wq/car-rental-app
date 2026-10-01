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

// --- Looking a place up by name ------------------------------------------
//
// Lives here because it exists only to fill in the delivery pin, and the
// booking form already talks to this router for the rates.
//
// Nominatim is OpenStreetMap's own search. It needs no key and costs
// nothing, which is the whole reason it is usable in a project with no
// budget — but it is a volunteer service with a fair-use policy, not a
// contract. Three things follow from that, and all three are why this is
// proxied rather than called from the browser:
//
//   It asks to be told who is calling. A browser cannot set its own
//   User-Agent; our server can.
//   It asks for no more than one request a second. A debounced input on
//   one machine respects that; several people typing at once would not.
//   Repeats should not be asked twice. The cache below means a popular
//   search costs one call, ever.
//
// If this is slow or down, the map still works and bookings still happen.
// Search is a convenience laid on top, never the thing standing between a
// customer and a booking.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Who to blame, as their policy asks.
const USER_AGENT = 'RentARideAlbay/1.0 (car rental booking, Legazpi PH)';
const MIN_GAP_MS = 1100;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 300;
const LOOKUP_TIMEOUT_MS = 6000;
// Bicol, as left,top,right,bottom. Results inside it are preferred, not
// required — somebody searching for a Manila address should still find it
// and then be told it is too far, rather than find nothing and wonder why.
const BICOL_VIEWBOX = '122.3,14.2,124.3,11.9';

const cache = new Map();

// Serialises every outgoing lookup and keeps a gap between them, so no
// amount of typing can exceed what the service asks for. A failure must
// not poison the chain for everybody behind it.
let queue = Promise.resolve();
let lastCall = 0;
const spaced = (fn) => {
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((resolve) => { setTimeout(resolve, wait); });
    lastCall = Date.now();
    return fn();
  });
  queue = run.then(() => {}, () => {});
  return run;
};

router.get('/geocode', protect, async (req, res) => {
  const q = String(req.query.q || '').trim();
  // Two letters matches half the country and wastes a lookup on something
  // nobody can choose from.
  if (q.length < 3) return res.json([]);

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return res.json(hit.value);

  try {
    const url = `${NOMINATIM}?format=jsonv2&limit=5&countrycodes=ph&viewbox=${BICOL_VIEWBOX}&q=${encodeURIComponent(q)}`;
    const results = await spaced(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      try {
        const upstream = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
          signal: controller.signal,
        });
        if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
        return upstream.json();
      } finally {
        clearTimeout(timer);
      }
    });

    const places = (Array.isArray(results) ? results : [])
      .map((r) => ({
        label: String(r.display_name || '').split(',').slice(0, 3).join(',').trim(),
        full: String(r.display_name || ''),
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { value: places, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(places);
  } catch (err) {
    // An empty list, not an error: the form shows "nothing found, tap the
    // map instead", which is true and still leaves them able to book.
    console.error('Place lookup failed:', err.message);
    res.json([]);
  }
});

export default router;
