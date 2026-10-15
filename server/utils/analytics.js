// Everything the Analytics page counts, kept away from the drawing of it.
//
// Two rules hold the page together. Money and demand count CONFIRMED and
// COMPLETED bookings only — a cancelled booking earned nothing and tells
// us nothing about demand. Cancellations are the one exception: that panel
// is about the bookings that fell through, so it counts every booking
// made. Each function says which it uses.
//
// Nothing here reads the clock on its own. The caller passes `now`, so the
// same figures can be reproduced in a test for any day.

import { phYmd, phDayStart, addDays } from './phTime.js';

const DAY = 24 * 60 * 60 * 1000;

export const COUNTED = ['confirmed', 'completed'];

// ── the range the whole page obeys ────────────────────────────────────
//
// A range is a pair of instants and the words for it. The end is the
// moment after the last day, so a comparison never has to care about the
// time of day inside it.
const phMonthStart = (now, back = 0) => {
  const [y, m] = phYmd(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1) - 8 * 60 * 60 * 1000);
};

export const RANGES = ['month', 'last', 'three', 'all'];

export const RANGE_LABELS = {
  month: 'This month',
  last: 'Last month',
  three: 'Last 3 months',
  all: 'All time',
};

export const rangeFor = (key, now, earliest = null) => {
  const tomorrow = addDays(phDayStart(now), 1);
  if (key === 'last') {
    return { key, start: phMonthStart(now, 1), end: phMonthStart(now, 0), byWeek: true };
  }
  if (key === 'three') {
    return { key, start: phMonthStart(now, 2), end: tomorrow, byWeek: false };
  }
  if (key === 'all') {
    return { key, start: earliest ? phDayStart(earliest) : null, end: tomorrow, byWeek: false };
  }
  return { key, start: phMonthStart(now, 0), end: tomorrow, byWeek: true };
};

export const inRange = (date, range) => {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (range.start && t < new Date(range.start).getTime()) return false;
  return t < new Date(range.end).getTime();
};

// ── money over time ───────────────────────────────────────────────────
//
// By pickup date, because that is when the vehicle actually earns. What
// is still to come in is the part of the price nobody has paid yet; a
// cancelled booking owes nothing, and is not here anyway.
export const moneyOverTime = (bookings, range) => {
  const counted = bookings.filter((b) => COUNTED.includes(b.status) && inRange(b.startDate, range));
  const revenue = counted.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const paid = counted.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
  const due = Math.max(0, revenue - paid);

  const buckets = new Map();
  for (const b of counted) {
    const ymd = phYmd(b.startDate);
    const key = range.byWeek ? weekKey(ymd) : ymd.slice(0, 7);
    const cell = buckets.get(key) || { key, revenue: 0, paid: 0 };
    cell.revenue += b.totalPrice || 0;
    cell.paid += b.amountPaid || 0;
    buckets.set(key, cell);
  }
  const columns = [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((c) => ({ ...c, due: Math.max(0, c.revenue - c.paid) }));

  return { revenue, collected: revenue - due, due, columns, byWeek: !!range.byWeek };
};

// Which week of the month a day falls in, as a sortable key. Weeks are
// the 1st–7th, 8th–14th and so on: calendar weeks would start the month
// mid-week and show a stub column nobody asked about.
export const weekKey = (ymd) => {
  const day = Number(ymd.slice(8, 10));
  return `${ymd.slice(0, 7)}-w${Math.ceil(day / 7)}`;
};

// ── what is charged on top of the rental ──────────────────────────────
//
// Each kind carries its own collected mark, so a fuel charge that was
// paid does not make a damage charge look paid with it.
export const extraCharges = (bookings, range) => {
  const counted = bookings.filter((b) => COUNTED.includes(b.status) && inRange(b.startDate, range));
  const kinds = [
    { key: 'late', label: 'Late fees', amount: (b) => b.lateFee?.amount || 0, paid: (b) => !!b.lateFee?.collectedAt },
    { key: 'fuel', label: 'Fuel shortfall', amount: (b) => b.fuel?.charge || 0, paid: (b) => !!b.fuel?.collectedAt },
    { key: 'damage', label: 'Damage', amount: (b) => b.condition?.damageCharge || 0, paid: (b) => !!b.condition?.damageCollectedAt },
  ];
  const rows = kinds.map((k) => {
    let settled = 0;
    let unsettled = 0;
    for (const b of counted) {
      const amount = k.amount(b);
      if (amount <= 0) continue;
      if (k.paid(b)) settled += amount;
      else unsettled += amount;
    }
    return { key: k.key, label: k.label, settled, unsettled, total: settled + unsettled };
  });
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const unsettled = rows.reduce((sum, r) => sum + r.unsettled, 0);
  return { rows, total, settled: total - unsettled, unsettled };
};

// ── bookings that fell through ────────────────────────────────────────
//
// The only panel that counts cancelled bookings, and it counts by the day
// the booking was MADE: a booking made in August and called off in
// October belongs to the August it was taken in.
//
// Whether a booking was called off before or after the office confirmed it
// is not recorded anywhere, so it is not guessed at here. What is known is
// whether money went back.
export const cancellations = (bookings, range) => {
  const made = bookings.filter((b) => inRange(b.createdAt, range));
  const cancelled = made.filter((b) => b.status === 'cancelled');
  const refunded = cancelled.filter((b) => b.refundStatus === 'approved');
  // A booking nobody ever paid for has nothing to give back, so counting
  // it as "not refunded" would read as money kept.
  const hadMoney = cancelled.filter((b) => (b.amountPaid || 0) > 0);

  // When a booking was confirmed and when it died were not recorded until
  // October 2026, so only the ones carrying a cancelled time can answer
  // this. The rest are not guessed at and not counted — the page says how
  // many it could read, so a small bar is never mistaken for a small
  // problem.
  const answerable = cancelled.filter((b) => b.cancelledAt);
  const afterConfirming = answerable.filter(
    (b) => b.confirmedAt && new Date(b.confirmedAt) <= new Date(b.cancelledAt),
  );

  return {
    made: made.length,
    kept: made.length - cancelled.length,
    cancelled: cancelled.length,
    refunded: refunded.length,
    notRefunded: Math.max(0, hadMoney.length - refunded.length),
    nothingPaid: cancelled.length - hadMoney.length,
    // The split, and how much of the pile it speaks for.
    recorded: answerable.length,
    afterConfirming: afterConfirming.length,
    beforeConfirming: answerable.length - afterConfirming.length,
  };
};

// ── what state each vehicle is in, right now ──────────────────────────
//
// This panel ignores the range: "right now" has no history. The order
// matters — a vehicle whose papers have run out is not merely unlisted,
// and one that is out with a client is out whatever else is true of it.
export const vehicleStates = (cars, bookings, now) => {
  const outIds = new Set(
    bookings
      .filter((b) => b.status === 'confirmed' && b.collectedAt && !b.returnedAt)
      .map((b) => String(b.car?._id || b.car)),
  );
  const states = { out: [], free: [], unlisted: [], offRoad: [], expired: [] };
  for (const car of cars) {
    // The id travels with the name: two vehicles can be the same make and
    // model, and anything drawing one segment each needs to tell them
    // apart.
    const it = { id: String(car._id), name: `${car.brand} ${car.model}` };
    if (outIds.has(it.id)) states.out.push(it);
    else if (car.registrationExpiry && new Date(car.registrationExpiry) < new Date(now)) states.expired.push(it);
    else if (car.offRoad?.since) states.offRoad.push(it);
    else if (car.isAvailable === false) states.unlisted.push(it);
    else states.free.push(it);
  }
  const overdue = bookings
    .filter((b) => b.status === 'confirmed' && b.collectedAt && !b.returnedAt && new Date(b.endDate) < new Date(now))
    .map((b) => ({ name: `${b.car?.brand} ${b.car?.model}`, due: b.endDate }));
  return { ...states, overdue, total: cars.length };
};

// ── which vehicles earn, and which sit ────────────────────────────────
//
// Days out is the part of each trip that falls inside the range, so a
// booking straddling the edge is split rather than counted twice.
//
// Days available is the range itself, minus the days we can PROVE the
// vehicle could not go out: after it went off the road, and after its
// papers expired. Unlisting leaves no date behind, so days a vehicle sat
// hidden are counted as available. That overstates nothing silently —
// `assumed` says how many vehicles it applies to, for the footnote.
export const vehicleEarnings = (cars, bookings, range, now) => {
  const start = range.start ? new Date(range.start).getTime() : null;
  const end = Math.min(new Date(range.end).getTime(), new Date(now).getTime() + DAY);

  const earliestTrip = bookings.reduce((min, b) => {
    const t = new Date(b.startDate).getTime();
    return !min || t < min ? t : min;
  }, null);
  const from = start ?? earliestTrip ?? end;

  const rows = cars.map((car) => {
    const mine = bookings.filter(
      (b) => COUNTED.includes(b.status) && String(b.car?._id || b.car) === String(car._id),
    );
    // Days OUT, not days booked: a vehicle cannot be out twice on the same
    // day, so two trips that overlap are one day each day they share.
    // Summing trip lengths produced "77 of 76 days · 101%".
    const daysSeen = new Set();
    let trips = 0;
    let earned = 0;
    for (const b of mine) {
      const s = Math.max(new Date(b.startDate).getTime(), from);
      const e = Math.min(new Date(b.endDate).getTime(), end);
      if (e <= s) continue;
      trips += 1;
      earned += b.totalPrice || 0;
      // A rental day runs from one morning to the next, so a trip of N
      // days occupies the N days starting the morning it goes out. Naming
      // each one collapses the overlap; counting hours would hand back a
      // day the vehicle never spent on the yard.
      const nights = Math.max(1, Math.round((e - s) / DAY));
      for (let i = 0; i < nights; i += 1) daysSeen.add(phYmd(new Date(s + i * DAY)));
    }
    const daysOut = daysSeen.size;

    let available = Math.max(0, Math.round((end - from) / DAY));
    const offRoadFrom = car.offRoad?.since ? new Date(car.offRoad.since).getTime() : null;
    const expiredFrom = car.registrationExpiry && new Date(car.registrationExpiry).getTime() < end
      ? new Date(car.registrationExpiry).getTime()
      : null;
    // Days the listing was switched off, now that switching it off leaves a
    // date behind. A vehicle nobody could see is not a vehicle nobody
    // happened to book.
    const hiddenFrom = car.isAvailable === false && car.unlistedSince
      ? new Date(car.unlistedSince).getTime()
      : null;
    const blockedFrom = [offRoadFrom, expiredFrom, hiddenFrom]
      .filter((t) => t !== null)
      .sort((a, b) => a - b)[0];
    if (blockedFrom) {
      const lost = Math.max(0, Math.round((end - Math.max(blockedFrom, from)) / DAY));
      available = Math.max(daysOut, available - lost);
    }

    return {
      id: String(car._id),
      name: `${car.brand} ${car.model}`,
      consignor: !!car.owner,
      trips,
      earned,
      daysOut,
      daysAvailable: available,
      share: available > 0 ? Math.round((daysOut / available) * 100) : 0,
      perDay: available > 0 ? Math.round(earned / available) : 0,
      reason: idleReason(car, now),
    };
  });

  rows.sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));
  const idle = rows.filter((r) => r.earned === 0);
  const totalOut = rows.reduce((sum, r) => sum + r.daysOut, 0);
  const totalAvailable = rows.reduce((sum, r) => sum + r.daysAvailable, 0);
  return {
    rows,
    idle: idle.length,
    earning: rows.length - idle.length,
    share: totalAvailable > 0 ? Math.round((totalOut / totalAvailable) * 100) : 0,
    assumed: cars.filter((c) => c.isAvailable === false && !c.offRoad?.since && !c.unlistedSince).length,
  };
};

// Why a vehicle earned nothing, in the words the office uses. Only ever
// shown on a vehicle that earned nothing — the rest need no excuse.
export const idleReason = (car, now) => {
  if (car.registrationExpiry && new Date(car.registrationExpiry) < new Date(now)) return 'Papers expired';
  if (car.offRoad?.since) return 'Off the road';
  if (car.isAvailable === false) return 'Not listed';
  return 'Listed, no bookings';
};

// ── when people book, how early, for how long ─────────────────────────
export const LEAD_BUCKETS = ['Same day', '1–2 days', '3–7 days', '8–14 days', '15–30 days', '30+ days'];
export const TRIP_BUCKETS = ['1 day', '2 days', '3–6 days', '7–13 days', '14+ days'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const leadBucket = (days) => {
  if (days <= 0) return 0;
  if (days <= 2) return 1;
  if (days <= 7) return 2;
  if (days <= 14) return 3;
  if (days <= 30) return 4;
  return 5;
};

const tripBucket = (days) => {
  if (days <= 1) return 0;
  if (days === 2) return 1;
  if (days <= 6) return 2;
  if (days <= 13) return 3;
  return 4;
};

export const demand = (bookings, range, discountFrom = null) => {
  const counted = bookings.filter((b) => COUNTED.includes(b.status) && inRange(b.startDate, range));
  const byDay = DOW.map(() => 0);
  const byLead = LEAD_BUCKETS.map(() => 0);
  const byTrip = TRIP_BUCKETS.map(() => 0);
  let long = 0;

  for (const b of counted) {
    // The weekday is read in Philippine time: a 7am pickup in Manila is
    // the night before in UTC, and would land on the wrong bar.
    byDay[new Date(`${phYmd(b.startDate)}T00:00:00Z`).getUTCDay()] += 1;
    const lead = Math.round(
      (new Date(`${phYmd(b.startDate)}T00:00:00Z`).getTime() - new Date(`${phYmd(b.createdAt)}T00:00:00Z`).getTime()) / DAY,
    );
    byLead[leadBucket(lead)] += 1;
    const days = b.totalDays || Math.max(1, Math.round((new Date(b.endDate) - new Date(b.startDate)) / DAY));
    byTrip[tripBucket(days)] += 1;
    if (discountFrom && days >= discountFrom) long += 1;
  }

  return { byDay, byLead, byTrip, long, total: counted.length };
};

// ── who comes back ────────────────────────────────────────────────────
//
// "Came back" is about the whole relationship, not the range: somebody
// who booked in May and again in October came back, whichever month you
// are looking at. "First booking" is the ones whose first ever booking
// falls inside the range.
export const clients = (bookings, range) => {
  const counted = bookings.filter((b) => COUNTED.includes(b.status));
  const byClient = new Map();
  for (const b of counted) {
    const id = String(b.user?._id || b.user?.email || 'unknown');
    const entry = byClient.get(id) || { trips: [], user: b.user };
    entry.trips.push(b);
    byClient.set(id, entry);
  }

  const inside = [...byClient.values()].filter((c) => c.trips.some((b) => inRange(b.startDate, range)));
  const returning = inside.filter((c) => c.trips.length > 1).length;
  const first = inside.filter((c) => {
    const earliest = c.trips.reduce((min, b) => (!min || new Date(b.startDate) < new Date(min) ? b.startDate : min), null);
    return inRange(earliest, range);
  }).length;

  // The office's own rating of each client, which never leaves this side
  // of the system. Counted per client, not per rental: five stars from
  // one person is one person.
  const stars = [0, 0, 0, 0, 0];
  let unrated = 0;
  for (const c of inside) {
    const score = c.user?.ratingCount > 0 ? Math.round(c.user.avgRating) : null;
    if (!score) unrated += 1;
    else stars[5 - Math.min(5, Math.max(1, score))] += 1;
  }

  return { booked: inside.length, returning, first, stars, unrated };
};

// ── what costs a day's rental ─────────────────────────────────────────
export const operations = (bookings, range, now) => {
  const counted = bookings.filter((b) => COUNTED.includes(b.status) && inRange(b.startDate, range));
  const late = counted.filter((b) => (b.lateFee?.days || 0) > 0);
  return {
    late: late.length,
    lateFees: late.reduce((sum, b) => sum + (b.lateFee?.amount || 0), 0),
    extensions: counted.filter((b) => (b.extensions?.length || 0) > 0).length,
    overdue: bookings.filter(
      (b) => b.status === 'confirmed' && b.collectedAt && !b.returnedAt && new Date(b.endDate) < new Date(now),
    ).length,
    withDriver: counted.filter((b) => b.driver).length,
    delivered: counted.filter((b) => (b.deliveryFee || 0) > 0).length,
  };
};
