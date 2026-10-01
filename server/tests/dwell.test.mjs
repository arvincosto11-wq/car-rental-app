import { suite, group, check } from './harness.mjs';
import { trackDwell, dwellState, dwellLabel, formatDwell, BLIND_SPOT_MS } from '../utils/dwell.js';

const now = new Date('2026-10-01T12:00:00+08:00');
const at = (mins) => new Date(now.getTime() + mins * 60 * 1000);
const minsAgo = (n) => at(-n);

// A reading, the shape fetchAikaGps returns.
const fix = (speed) => ({ speed });

// A stored gps block for a vehicle standing still.
const stopped = (over = {}) => ({
  updatedAt: now,
  speed: 0,
  ignitionOn: false,
  isMock: false,
  ...over,
});

export default function run() {
  suite('Dwell');

  group('the stop clock, kept across readings');
  // First ever reading: nothing to carry, so the watch starts here.
  const first = trackDwell(null, fix(0), now);
  check('starts the watch', first.observedSince.getTime(), now.getTime());
  check('has never seen it move', first.lastMovedAt, null);

  // A normal 30-second poll while it drives.
  const moving = trackDwell({ lastSeenAt: minsAgo(0.5), observedSince: minsAgo(10) }, fix(42), now);
  check('records the movement', moving.lastMovedAt.getTime(), now.getTime());
  check('keeps the watch unbroken', moving.observedSince.getTime(), minsAgo(10).getTime());

  // Still parked: the moment it stopped must NOT creep forward, or the
  // duration would reset itself to zero on every single poll.
  const still = trackDwell({ lastSeenAt: minsAgo(0.5), observedSince: minsAgo(60), lastMovedAt: minsAgo(45) }, fix(0), now);
  check('leaves the stop where it was', still.lastMovedAt.getTime(), minsAgo(45).getTime());

  group('a gap in the watching breaks the clock');
  // Nobody had the page open for eleven hours. Anything the vehicle did in
  // there is invisible to us, so the watch cannot claim to cover it.
  const afterGap = trackDwell({ lastSeenAt: minsAgo(660), observedSince: minsAgo(700), lastMovedAt: minsAgo(690) }, fix(0), now);
  check('restarts the watch', afterGap.observedSince.getTime(), now.getTime());
  check('but remembers the last movement it saw', afterGap.lastMovedAt.getTime(), minsAgo(690).getTime());

  // A few missed polls are not a gap — trackers drop requests and browsers
  // throttle background tabs, and resetting on every hiccup would make the
  // figure useless.
  const blip = trackDwell({ lastSeenAt: new Date(now.getTime() - BLIND_SPOT_MS + 1000), observedSince: minsAgo(90) }, fix(0), now);
  check('survives a few missed polls', blip.observedSince.getTime(), minsAgo(90).getTime());

  group('what we are willing to claim');
  // Watched the whole time: the figure is exact.
  const watched = stopped({ lastMovedAt: minsAgo(200), observedSince: minsAgo(400) });
  check('exact when we saw it stop', dwellState(watched, now).ms, 200 * 60 * 1000);
  check('and says so', dwellState(watched, now).atLeast, false);
  check('reads as hours and minutes', dwellLabel(watched, now), 'Parked 3h 20m');

  // The vehicle stopped BEFORE the current stretch of watching began, so
  // it may well have driven around in between. The only honest answer is a
  // floor — this is the case that would otherwise invent eleven hours of
  // parking for a vehicle that was out all night.
  const unwatched = stopped({ lastMovedAt: minsAgo(690), observedSince: minsAgo(20) });
  check('falls back to a floor', dwellState(unwatched, now).ms, 20 * 60 * 1000);
  check('and marks it as one', dwellState(unwatched, now).atLeast, true);
  check('never quotes the unwatched hours', dwellLabel(unwatched, now), 'Parked 20m+');

  // Just opened the page on a long-parked vehicle: "Parked 0m+" is noise,
  // so the state alone is all it says until there is something to add.
  const justOpened = stopped({ lastMovedAt: minsAgo(690), observedSince: minsAgo(0.2) });
  check('says nothing it cannot back up', dwellLabel(justOpened, now), 'Parked');

  group('idling is its own state');
  const idling = stopped({ ignitionOn: true, lastMovedAt: minsAgo(14), observedSince: minsAgo(60) });
  check('engine on, going nowhere', dwellState(idling, now).state, 'idling');
  check('worded apart from parked', dwellLabel(idling, now), 'Idling 14m');
  const parked = stopped({ ignitionOn: false, lastMovedAt: minsAgo(14), observedSince: minsAgo(60) });
  check('engine off is parked', dwellState(parked, now).state, 'parked');

  group('moving, and not tracked at all');
  const driving = stopped({ speed: 42, ignitionOn: true });
  check('no duration while moving', dwellState(driving, now).state, 'moving');
  check('shows the speed instead', dwellLabel(driving, now), '42 km/h');
  check('a placeholder position is not a reading', dwellState({ isMock: true, updatedAt: now }, now).state, 'untracked');
  check('nor is a car that never reported', dwellState({ updatedAt: null }, now).state, 'untracked');
  check('and neither gets a label', dwellLabel({ isMock: true, updatedAt: now }, now), '');

  group('a skewed browser clock cannot produce a negative');
  // These timestamps come from the server and are read on someone's
  // laptop, which may be minutes behind.
  const future = stopped({ lastMovedAt: at(5), observedSince: at(4) });
  check('clamped at zero', dwellState(future, now).ms, 0);

  group('durations, said the way a person says them');
  check('under a minute', formatDwell(30 * 1000), 'under a minute');
  check('minutes', formatDwell(14 * 60 * 1000), '14m');
  check('a round hour', formatDwell(60 * 60 * 1000), '1h');
  check('hours and minutes', formatDwell(200 * 60 * 1000), '3h 20m');
  check('a round day', formatDwell(24 * 60 * 60 * 1000), '1d');
  check('days and hours', formatDwell(30 * 60 * 60 * 1000), '1d 6h');
}
