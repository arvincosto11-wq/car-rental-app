// Looking up a place by name, for the handover map.
//
// This used to go through our own server, which proxied Nominatim so the
// rate limiting and the cache could be ours. In production it came back
// empty for every search: OpenStreetMap refuses Nominatim requests from
// Render's address, the way it refuses most shared cloud addresses. The
// same request answers in under a second from a laptop and from a browser,
// so it is the caller being turned away, not the query.
//
// The route swallowed that failure and returned an empty list, which is
// kind to the booking — the map still works, so nobody is stuck — but it
// also meant a broken search looked exactly like a place that does not
// exist, and the reason only ever appeared in the server's log.
//
// So the lookup happens here now, from the person's own connection. That
// is the shape OSM's policy is written for: one person typing, rather than
// one server asking on behalf of everybody. Attribution is already on the
// map itself, which Leaflet draws.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Two letters matches half the country and wastes a lookup on a list
// nobody can choose from.
export const MIN_QUERY = 3;

// Bicol, as left,top,right,bottom. Results inside it are preferred, not
// required — somebody searching a Manila address should still find it and
// then be told it is too far, rather than find nothing and wonder why.
const BICOL_VIEWBOX = '122.3,14.2,124.3,11.9';

const TIMEOUT_MS = 6000;

// The same name gets typed again every time somebody backspaces a
// character and puts it back. Kept for the life of the page only.
const cache = new Map();

export const lookupPlaces = async (raw) => {
  const q = String(raw || '').trim();
  if (q.length < MIN_QUERY) return [];

  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const url = `${NOMINATIM}?format=jsonv2&limit=5&countrycodes=ph`
    + `&viewbox=${BICOL_VIEWBOX}&q=${encodeURIComponent(q)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    const places = (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        // The first three parts are the recognisable ones: the place, its
        // town and its province. The rest is postcode and country.
        label: String(r.display_name || '').split(',').slice(0, 3).join(',').trim(),
        full: String(r.display_name || ''),
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    // Only a real answer is remembered. A failure cached is a search that
    // stays broken for the rest of the visit.
    cache.set(key, places);
    return places;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
};
