// What it costs to have a vehicle brought to you, or collected from you.
//
// The business works out of one place (Salugan, Camalig). Anywhere else is
// somebody driving the vehicle there and back, so it is priced by how far
// that is. Three decisions are baked in here rather than left to each
// screen that quotes a number:
//
//   Straight-line distance is not road distance. A pin 10 km away as the
//   crow flies is further than that by road — rivers, the mountain, the
//   way Albay's roads actually run. Multiplying by a factor is the standard
//   rough correction and it is deliberately generous: quoting less than the
//   trip really costs is the expensive mistake.
//
//   The first few kilometres are free. A business that charges ₱25 to cross
//   its own barangay loses the booking over ₱25, and the driver was going
//   to be there anyway.
//
//   Past some distance it is not a delivery, it is a different business.
//   That boundary is what answers "what happens if somebody books from
//   outside Albay" — they are told we don't go that far, before they pay,
//   rather than after.
//
// Every number above is a setting, because none of them is ours to decide.
// Defaults here are only what applies before anybody has set anything.
//
// This file has no imports so the client keeps an identical copy (see
// server/utils/delivery.js). The quote shown while choosing a place and
// the quote charged at checkout have to be the same number, and the server
// recomputes it either way — see routes/bookings.js, which never trusts a
// fee that arrived from a browser.

// Mean radius of the earth. Haversine on a sphere is accurate to well
// under a percent at these distances, and the road factor below is a far
// bigger approximation than the shape of the planet.
const EARTH_RADIUS_KM = 6371;

export const DEFAULTS = {
  enabled: true,
  // Salugan, Camalig, Albay — a starting point, not a surveyed one. Admin
  // moves the pin to where the vehicles actually are.
  base: { label: 'Salugan, Camalig, Albay', lat: 13.1769, lng: 123.6553 },
  freeKm: 3,
  ratePerKm: 25,
  maxKm: 60,
  roadFactor: 1.3,
};

const toRad = (deg) => (deg * Math.PI) / 180;

const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

// Is this actually a point on earth somebody could have picked? Guards the
// two ways a bad one arrives: a tampered request, and a map that handed
// back undefined.
export function isPoint(p) {
  return !!p
    && typeof p.lat === 'number' && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90
    && typeof p.lng === 'number' && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
}

// Great-circle distance between two points, in kilometres.
export function haversineKm(a, b) {
  if (!isPoint(a) || !isPoint(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Fills in whatever the settings document is missing, so one unset field
// can never make a quote come back as NaN.
export function deliverySettings(saved) {
  // Accepts either shape: the stored document ({ base, delivery: {...} })
  // or the already-flattened form the API serves and the browser holds.
  // Without this, passing a flattened object back through would find no
  // .delivery and quietly answer with the defaults — the browser would show
  // ₱25/km while the server charged whatever was really set, and both would
  // look correct in isolation.
  const d = saved?.delivery || saved || {};
  const base = saved?.base || {};
  return {
    enabled: d.enabled !== false,
    base: isPoint(base) ? { label: base.label || DEFAULTS.base.label, lat: base.lat, lng: base.lng } : DEFAULTS.base,
    freeKm: Math.max(0, num(d.freeKm, DEFAULTS.freeKm)),
    ratePerKm: Math.max(0, num(d.ratePerKm, DEFAULTS.ratePerKm)),
    maxKm: Math.max(0, num(d.maxKm, DEFAULTS.maxKm)),
    roadFactor: Math.max(1, num(d.roadFactor, DEFAULTS.roadFactor)),
  };
}

// What one leg — a pickup, or a return — costs.
//
//   km            road-allowed distance from base, rounded to 1 decimal
//   chargeableKm  what is left after the free allowance
//   fee           pesos, whole
//   ok            false when it is further than we go
//
// A null point means "the default place", which is the base itself: no
// distance, no fee, always allowed. That is the common case and it must
// never be an error.
export function legQuote(point, settings) {
  const s = deliverySettings(settings);
  if (!point) return { km: 0, chargeableKm: 0, fee: 0, ok: true, atBase: true };
  if (!isPoint(point)) return { km: 0, chargeableKm: 0, fee: 0, ok: false, atBase: false, reason: 'invalid' };

  const straight = haversineKm(s.base, point);
  const km = Math.round(straight * s.roadFactor * 10) / 10;
  if (!s.enabled) return { km, chargeableKm: 0, fee: 0, ok: false, atBase: false, reason: 'disabled' };
  if (km > s.maxKm) return { km, chargeableKm: 0, fee: 0, ok: false, atBase: false, reason: 'too_far' };

  const chargeableKm = Math.max(0, Math.round((km - s.freeKm) * 10) / 10);
  return {
    km,
    chargeableKm,
    fee: Math.round(chargeableKm * s.ratePerKm),
    ok: true,
    atBase: km === 0,
  };
}

// Both legs together, which is what goes on the booking. Priced
// separately because they are two separate trips: somebody delivering to
// Tabaco and collecting from Legazpi drives both, and charging once would
// be charging for the shorter of the two.
export function deliveryQuote(pickupPoint, returnPoint, settings) {
  const pickup = legQuote(pickupPoint, settings);
  const ret = legQuote(returnPoint, settings);
  return {
    pickup,
    return: ret,
    fee: pickup.ok && ret.ok ? pickup.fee + ret.fee : 0,
    ok: pickup.ok && ret.ok,
    reason: pickup.ok ? ret.reason : pickup.reason,
  };
}

// The sentence to show when a place can't be served. Said here so the
// booking form, the server's rejection and the admin screen all give the
// same reason.
export function deliveryRefusal(reason, settings) {
  const s = deliverySettings(settings);
  if (reason === 'too_far') {
    return `That's further than we deliver — we go up to ${s.maxKm} km from ${s.base.label}. Please call us to arrange it.`;
  }
  if (reason === 'disabled') {
    return `We're only handing over at ${s.base.label} at the moment.`;
  }
  if (reason === 'invalid') return 'Please pick a place on the map.';
  return '';
}
