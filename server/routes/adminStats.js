import express from 'express';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Consignment from '../models/Consignment.js';
import Car from '../models/Car.js';
import Appointment from '../models/Appointment.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { remindStalePendingBookings } from '../utils/pendingReminders.js';
import { expireAdjustOffers } from '../utils/adjustOffer.js';
import { APPOINTMENT_OPEN } from '../utils/appointments.js';
import { fail } from '../utils/respond.js';
import { isOverdue } from '../utils/overdue.js';
import { phYmd, phDayStart, addDays } from '../utils/phTime.js';
import {
  balanceDue, lateFeeSoFar, unsettledCharges, vehicleState, comparePeriods,
} from '../utils/adminToday.js';

const router = express.Router();

// Live counts of unresolved items per admin section, used to badge the
// sidebar. Deliberately NOT based on Notification read/unread state —
// that lagged behind reality (a badge stayed lit after the admin actually
// resolved something through the normal workflow, since resolving an item
// doesn't mark its notification read). These counts always reflect the
// current data, so a badge clears the instant the underlying item is
// actually handled.
const EXPIRY_WINDOW_DAYS = 30;

router.get('/pending-counts', protect, adminOnly, async (req, res) => {
  try {
    // The admin dashboard polls this, so an open dashboard keeps the
    // escalation moving even when no client is browsing.
    await remindStalePendingBookings();
    // An unanswered offer of alternative dates has to refund itself on time
    // even if no client happens to load a page — the dashboard poll is the
    // one thing that runs reliably.
    await expireAdjustOffers();
    const expiryCutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [pendingBookings, refundRequests, rescheduleRequests, needsDriver, pendingConsignments, openAppointments, pendingAvailability, pendingBlockedDates, expiringRegistrations] = await Promise.all([
      Booking.countDocuments({ status: 'pending', payment: 'paid', 'adjustOffer.status': { $ne: 'open' } }),
      Booking.countDocuments({ refundStatus: 'requested' }),
      Booking.countDocuments({ 'rescheduleRequest.status': 'pending' }),
      // A trip that is on, with a driver nobody has named yet.
      //
      // Confirmed and not yet collected, deliberately. Counting every
      // with-driver booking without a driver would light this up with every
      // finished and cancelled trip in the system — 154 of them on the day
      // this was written, none of which can ever be filled in — and a badge
      // that is always on is a badge nobody reads.
      Booking.countDocuments({
        status: 'confirmed',
        bookingType: 'with-driver',
        driver: null,
        collectedAt: null,
      }),
      // Manage Clients no longer carries a badge: there is no ID photo to
      // review any more, so nothing arrives there needing a decision. See
      // models/User.js.
      Consignment.countDocuments({ status: 'pending' }),
      // Every live appointment is an open loop: a request needs answering,
      // and an accepted one still has to be marked once the day comes. It
      // stops counting the moment it is closed, whichever way.
      Appointment.countDocuments({ status: { $in: APPOINTMENT_OPEN } }),
      Car.countDocuments({ 'availabilityRequest.status': 'pending' }),
      // A car can have several pending blocked-date ranges at once (unlike
      // the single-slot availabilityRequest), so this counts individual
      // requests via $unwind rather than cars.
      Car.aggregate([
        { $unwind: '$blockedDates' },
        { $match: { 'blockedDates.status': 'pending' } },
        { $count: 'count' },
      ]),
      Car.countDocuments({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: expiryCutoff } }),
    ]);
    res.json({
      '/admin/manage-bookings': pendingBookings + refundRequests + rescheduleRequests + needsDriver,
      '/admin/manage-consignments': pendingConsignments,
      '/admin/appointments': openAppointments,
      '/admin/availability-requests': pendingAvailability + (pendingBlockedDates[0]?.count || 0),
      '/admin/expiring-documents': expiringRegistrations,
    });
  } catch (err) {
    fail(res, err);
  }
});

// Everything with an on-file expiry date that's already expired or due
// within the next 30 days, across the three document types that actually
// carry one: a user's valid ID, a user's driver's license, and a car's
// registration (CR). Consolidated into one response instead of three
// separate checks, since admin cares about "what needs attention soon"
// as a single list, not which category it happens to be.

// Everything the dashboard needs to answer "what does today need?".
//
// Separate from /stats, which answers "how is the business doing" and is
// all aggregates. This one is about named bookings on a named day, so it
// reads whole documents and hands back only the fields the page shows.
router.get('/today', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const dayStart = phDayStart(now);
    const dayEnd = addDays(dayStart, 1);
    const today = phYmd(now);

    const expiryCutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [live, cars, appointments, owing, waiting] = await Promise.all([
      // Anything that could be on today's schedule or already out.
      Booking.find({ status: 'confirmed' })
        .populate('car', 'brand model plateNumber pricePerDay image')
        .populate('user', 'name phone')
        .populate('driver', 'name')
        .lean(),
      Car.find({ archived: { $ne: true } })
        .select('brand model isAvailable offRoad registrationExpiry')
        .lean(),
      Appointment.find({ status: { $in: APPOINTMENT_OPEN }, slot: { $gte: dayStart, $lt: dayEnd } })
        .populate('owner', 'name phone')
        .lean(),
      // Charges live on finished bookings too, so this is its own query
      // rather than a filter over the confirmed ones.
      Booking.find({
        $or: [
          { 'lateFee.amount': { $gt: 0 }, 'lateFee.collectedAt': null },
          { 'fuel.charge': { $gt: 0 }, 'fuel.collectedAt': null },
          { 'condition.damageCharge': { $gt: 0 }, 'condition.damageCollectedAt': null },
        ],
      })
        .populate('car', 'brand model')
        .populate('user', 'name')
        .lean(),
      // The same nine things the sidebar badges, counted one at a time.
      // The badge endpoint adds four of them together, which is right for a
      // dot on a menu and useless on a list that says what to go and do.
      (async () => {
        const [bookingsToReview, refunds, reschedules, needsDriver, consignments, openAppointments, availability, blocked, registrations] = await Promise.all([
          Booking.countDocuments({ status: 'pending', payment: 'paid', 'adjustOffer.status': { $ne: 'open' } }),
          Booking.countDocuments({ refundStatus: 'requested' }),
          Booking.countDocuments({ 'rescheduleRequest.status': 'pending' }),
          Booking.countDocuments({ status: 'confirmed', bookingType: 'with-driver', driver: null, collectedAt: null }),
          Consignment.countDocuments({ status: 'pending' }),
          Appointment.countDocuments({ status: { $in: APPOINTMENT_OPEN } }),
          Car.countDocuments({ 'availabilityRequest.status': 'pending' }),
          Car.aggregate([
            { $unwind: '$blockedDates' },
            { $match: { 'blockedDates.status': 'pending' } },
            { $count: 'count' },
          ]),
          Car.countDocuments({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: expiryCutoff } }),
        ]);
        return {
          bookingsToReview, refunds, reschedules, needsDriver, consignments,
          appointments: openAppointments,
          availability,
          blockedDates: blocked[0]?.count || 0,
          registrations,
        };
      })(),
    ]);

    const onDay = (date) => phYmd(date) === today;
    const place = (p) => (p && p.label ? { label: p.label, km: p.km || 0 } : null);
    const base = (b) => ({
      id: b._id,
      client: b.user?.name || 'Unknown',
      phone: b.user?.phone || '',
      vehicle: b.car ? `${b.car.brand} ${b.car.model}` : 'Vehicle removed',
      bookingType: b.bookingType,
      driver: b.driver?.name || '',
      hasTime: !!b.hasPickupTime,
    });

    const pickups = live
      .filter((b) => onDay(b.startDate) && !b.collectedAt)
      .map((b) => ({
        ...base(b),
        at: b.startDate,
        place: place(b.pickupPlace),
        balance: balanceDue(b),
      }));

    const returns = live
      .filter((b) => onDay(b.endDate) && b.collectedAt && !b.returnedAt)
      .map((b) => ({ ...base(b), at: b.endDate, place: place(b.returnPlace) }));

    // A delivery is a pickup or a return with somewhere to be. The same
    // booking can appear in both lanes, once at each end.
    const deliveries = [
      ...pickups.filter((p) => p.place).map((p) => ({ ...p, leg: 'Drop-off' })),
      ...returns.filter((r) => r.place).map((r) => ({ ...r, leg: 'Collection' })),
    ];

    const overdue = live
      .filter((b) => isOverdue(b, now))
      .map((b) => ({
        ...base(b),
        at: b.endDate,
        lateFee: lateFeeSoFar(b, b.car?.pricePerDay, now),
      }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));

    const inspections = appointments.map((a) => ({
      id: a._id,
      at: a.slot,
      owner: a.owner?.name || 'Owner',
      phone: a.owner?.phone || '',
      note: a.vehicle?.note || '',
    }));

    // ── money ───────────────────────────────────────────────────────────
    const dueAtCollection = pickups
      .filter((p) => p.balance > 0)
      .map((p) => ({ id: p.id, client: p.client, vehicle: p.vehicle, at: p.at, hasTime: p.hasTime, amount: p.balance }));

    const charges = owing.flatMap((b) => unsettledCharges(b).map((c) => ({
      id: b._id,
      kind: c.kind,
      days: c.days,
      client: b.user?.name || 'Unknown',
      vehicle: b.car ? `${b.car.brand} ${b.car.model}` : 'Vehicle removed',
      amount: c.amount,
    })));

    const gcash = await Booking.find({ payment: 'gcash_pending' })
      .populate('car', 'brand model')
      .populate('user', 'name')
      .select('amountPaid createdAt car user')
      .lean();

    const sum = (rows) => rows.reduce((n, r) => n + (r.amount || 0), 0);

    // ── vehicles ────────────────────────────────────────────────────────
    const outIds = new Set(live.filter((b) => b.collectedAt && !b.returnedAt).map((b) => String(b.car?._id)));
    const vehicles = { out: [], free: [], hidden: [], offRoad: [], expired: [] };
    cars.forEach((c) => {
      const entry = { id: c._id, name: `${c.brand} ${c.model}` };
      if (c.offRoad?.since) entry.since = c.offRoad.since;
      vehicles[vehicleState(c, outIds, now)].push(entry);
    });

    // ── revenue, against the same stretch of the period before ──────────
    const earned = await Booking.find({ status: { $in: ['confirmed', 'completed'] } })
      .select('createdAt totalPrice').lean();
    const between = (from, to) => earned
      .filter((b) => new Date(b.createdAt) >= from && new Date(b.createdAt) < to)
      .reduce((n, b) => n + (b.totalPrice || 0), 0);

    const weekStart = addDays(dayStart, -6);
    const prevWeekStart = addDays(weekStart, -7);
    const monthStart = new Date(dayStart);
    monthStart.setUTCDate(1);
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);
    // The same number of days into last month as we are into this one, so
    // a comparison on the 14th is 1–14 against 1–14.
    const daysIn = Math.round((dayEnd - monthStart) / (24 * 60 * 60 * 1000));
    const prevMonthSamePoint = addDays(prevMonthStart, daysIn);

    const thisWeek = between(weekStart, dayEnd);
    const thisMonth = between(monthStart, dayEnd);
    const lastWeek = between(prevWeekStart, weekStart);
    const lastMonthToDate = between(prevMonthStart, prevMonthSamePoint);

    res.json({
      now,
      schedule: { pickups, returns, deliveries, inspections },
      overdue,
      money: {
        dueAtCollection: { rows: dueAtCollection, total: sum(dueAtCollection) },
        charges: { rows: charges, total: sum(charges) },
        gcash: {
          rows: gcash.map((b) => ({
            id: b._id,
            client: b.user?.name || 'Unknown',
            vehicle: b.car ? `${b.car.brand} ${b.car.model}` : 'Vehicle removed',
            at: b.createdAt,
            amount: b.amountPaid || 0,
          })),
          total: gcash.reduce((n, b) => n + (b.amountPaid || 0), 0),
        },
      },
      vehicles,
      waiting,
      compare: {
        week: { previous: lastWeek, pct: comparePeriods(thisWeek, lastWeek) },
        month: {
          previous: lastMonthToDate,
          pct: comparePeriods(thisMonth, lastMonthToDate),
          from: prevMonthStart,
          to: prevMonthSamePoint,
        },
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

router.get('/expiring-documents', protect, adminOnly, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Licences are no longer listed here. The date is the client's own
    // account of their own papers now, and nothing admin can do about it —
    // the client still gets their renewal reminder, and an expired one still
    // refuses a self-drive booking. A vehicle's registration is different:
    // it has to be chased, and an expired one stops the vehicle going out.
    const [registrationCars] = await Promise.all([
      Car.find({ archived: { $ne: true }, registrationExpiry: { $ne: null, $lte: cutoff } })
        .select('brand model plateNumber registrationExpiry owner')
        .populate('owner', 'name')
        .sort({ registrationExpiry: 1 }),
    ]);

    res.json({
      registrations: registrationCars.map((c) => ({
        carId: c._id, brand: c.brand, model: c.model, plateNumber: c.plateNumber,
        ownerName: c.owner?.name || null, expiry: c.registrationExpiry,
      })),
    });
  } catch (err) {
    fail(res, err);
  }
});


// Everything the admin dashboard draws, worked out here instead of shipped.
//
// It used to ask for every booking in the system — 164 of them, with their
// vehicles attached, about 400 KB — and then count them in the browser to
// show four numbers, a six-month chart, five rows and five vehicles. The
// counting is the cheap part; the carrying was the expensive one.
//
// Dates are measured in Philippine time rather than the browser's, so the
// figure does not shift depending on which machine is looking at it. The
// boundaries come back with the numbers so the captions can say exactly
// what period they describe.
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const phNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    // Month boundaries built from PH wall-clock parts, then shifted back to
    // real instants to compare against stored dates.
    const phMonthStart = (back) => new Date(Date.UTC(
      phNow.getUTCFullYear(),
      phNow.getUTCMonth() - back,
      1,
    ) - 8 * 60 * 60 * 1000);
    const startOfMonth = phMonthStart(0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Only the two fields the sums need.
    //
    // Confirmed AND completed. It used to be confirmed alone, which meant a
    // booking counted as revenue while the trip was still ahead of it and
    // stopped counting the moment the vehicle came back — so the figure went
    // DOWN as business got done, and "all time" showed whatever happened to
    // be upcoming that day. With 78 finished trips on the books it read
    // ₱2,000. Cancelled stays out: that money was never earned.
    //
    // This is also what Analytics has always counted, so the two screens now
    // agree about the same money instead of giving different answers.
    const [cars, earnedMoney, statusCounts, totalBookings, recent] = await Promise.all([
      Car.find({ archived: { $ne: true } })
        .select('brand model image avgRating ratingCount')
        .lean(),
      Booking.find({ status: { $in: ['confirmed', 'completed'] } }).select('createdAt totalPrice').lean(),
      Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Booking.countDocuments(),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('status totalPrice createdAt startDate car')
        .populate('car', 'brand model image')
        .lean(),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]));
    const sumSince = (cutoff) => earnedMoney
      .filter((b) => new Date(b.createdAt) >= cutoff)
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // Six buckets ending with the month we are in, labelled the way the
    // chart prints them.
    const trend = Array.from({ length: 6 }).map((unused, i) => {
      const start = phMonthStart(5 - i);
      const end = phMonthStart(4 - i);
      return {
        label: new Date(start.getTime() + 8 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
        value: earnedMoney
          .filter((b) => {
            const at = new Date(b.createdAt);
            return at >= start && at < end;
          })
          .reduce((sum, b) => sum + (b.totalPrice || 0), 0),
      };
    });

    res.json({
      stats: {
        totalCars: cars.length,
        totalBookings,
        pending: byStatus.pending || 0,
        confirmed: byStatus.confirmed || 0,
      },
      revenue: {
        week: sumSince(startOfWeek),
        month: sumSince(startOfMonth),
        all: earnedMoney.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
      },
      monthlyTrend: trend,
      recentBookings: recent,
      topRatedCars: cars
        .filter((c) => c.ratingCount > 0)
        .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount)
        .slice(0, 5),
      periods: { weekStart: startOfWeek, monthStart: startOfMonth, today: now },
    });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
