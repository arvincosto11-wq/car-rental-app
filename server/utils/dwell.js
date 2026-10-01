// How long a vehicle has been sitting still, and whether we can stand
// behind the figure.
//
// The tracker tells us a position, a speed and an ignition state — never a
// duration. We only ever stored the latest of those, each one overwriting
// the last, so nothing in the system remembered the moment a vehicle
// stopped. Three fields fix that, and the third one is the honest one:
//
//   lastMovedAt     the most recent reading that showed movement
//   lastSeenAt      the most recent reading of any kind
//   observedSince   the start of the current unbroken stretch of watching
//
// Why observedSince has to exist: we only poll while somebody has the GPS
// page open. If a vehicle drives across town overnight with nobody
// watching, lastMovedAt still points at yesterday evening, and
// "now - lastMovedAt" would announce eleven hours parked for a vehicle
// that was out all night. That is the dangerous direction to be wrong in —
// it invents a fact rather than omitting one.
//
// So a gap in the watching restarts observedSince, and a duration is only
// quoted outright when the moment of stopping falls inside the stretch we
// actually saw. Otherwise the answer is "at least this long", which is the
// most that can honestly be claimed.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/dwell.js) — the figure on the card, the figure in the
// popup and any later rule about idling all have to agree.

// A pause longer than this means we stopped watching rather than simply
// waited for the next poll. Polls are 30 seconds apart, so this allows
// several to be missed (a slow tracker, a dropped request, a tab the
// browser throttled) before the clock is treated as broken.
export const BLIND_SPOT_MS = 3 * 60 * 1000;

// Below this there is nothing useful to say, and "parked 0m" reads like a
// bug rather than a fact.
export const MIN_REPORTABLE_MS = 60 * 1000;

const ms = (d) => (d ? new Date(d).getTime() : null);

// Called with each successful fix, BEFORE the new reading is stored.
// Returns the three fields to save alongside it.
export function trackDwell(prevGps, fix, now = new Date()) {
  const at = now instanceof Date ? now : new Date(now);
  const seen = ms(prevGps?.lastSeenAt);
  const unwatched = seen === null || at.getTime() - seen > BLIND_SPOT_MS;

  return {
    lastSeenAt: at,
    // A break in the watching makes everything before it unusable as a
    // continuous record, so the stretch starts again here.
    observedSince: unwatched || !prevGps?.observedSince ? at : new Date(prevGps.observedSince),
    lastMovedAt: fix?.speed > 0 ? at : (prevGps?.lastMovedAt ? new Date(prevGps.lastMovedAt) : null),
  };
}

// What this vehicle is doing, and for how long.
//
//   state    'moving' | 'idling' | 'parked' | 'untracked'
//   ms       how long it has been sitting, or null if unknown
//   atLeast  true when the figure is a floor rather than the real duration
//
// Idling and parked are deliberately separate: an engine left running is
// fuel being spent on nothing, which somebody may want to act on, while a
// vehicle parked overnight is just a vehicle parked overnight.
export function dwellState(gps, now = new Date()) {
  if (!gps || gps.isMock || !gps.updatedAt) return { state: 'untracked', ms: null, atLeast: false };
  if (gps.speed > 0) return { state: 'moving', ms: null, atLeast: false };

  const state = gps.ignitionOn ? 'idling' : 'parked';
  const at = (now instanceof Date ? now : new Date(now)).getTime();
  const moved = ms(gps.lastMovedAt);
  const since = ms(gps.observedSince);

  // The server's clock sets these and the browser's clock reads them, so a
  // skewed machine must not produce a negative duration.
  const elapsed = (from) => Math.max(0, at - from);

  // Known exactly: we were watching when it stopped.
  if (moved !== null && since !== null && moved >= since) {
    return { state, ms: elapsed(moved), atLeast: false };
  }
  // Watched only since partway through: all we can say is "at least".
  if (since !== null) return { state, ms: elapsed(since), atLeast: true };
  return { state, ms: null, atLeast: false };
}

// "3h 20m", "14m", "2d 4h" — how somebody glancing at a screen would say
// it, never "200 minutes".
export function formatDwell(duration) {
  if (duration === null || duration === undefined) return '';
  const minutes = Math.floor(duration / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

// The whole phrase, e.g. "Parked 3h 20m", "Idling 14m+", "42 km/h".
// Returns '' for a vehicle with no real tracker, which the caller words
// its own way.
export function dwellLabel(gps, now = new Date()) {
  const d = dwellState(gps, now);
  if (d.state === 'untracked') return '';
  if (d.state === 'moving') return `${Math.round(gps.speed)} km/h`;

  const word = d.state === 'idling' ? 'Idling' : 'Parked';
  // Too short, or too uncertain to put a number on: the state alone is
  // still true, so say that and stop.
  if (d.ms === null || (d.atLeast && d.ms < MIN_REPORTABLE_MS)) return word;
  return `${word} ${formatDwell(d.ms)}${d.atLeast ? '+' : ''}`;
}
