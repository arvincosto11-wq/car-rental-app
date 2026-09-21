import mongoose from 'mongoose';
import { suite, group, check } from './harness.mjs';
import { offerDeadline, hasEnoughNotice, isOfferOpen, bookingAwaitingDecision, timeLeftLabel, offerMessage, offerReasonText } from '../utils/offerWindow.js';
import { nearbyRanges } from '../utils/adjustOffer.js';
import { blockedSpan } from '../utils/availability.js';
import { instantFrom, formatPhDateTime, phYmd } from '../utils/phTime.js';
import Booking from '../models/Booking.js';

const now = new Date('2026-09-21T10:00:00+08:00');
const inHours = (n) => new Date(now.getTime() + n * 3600000);
const inDays = (n) => new Date(now.getTime() + n * 86400000);

const busy = (...ranges) => ranges.map(([a, b]) => blockedSpan({
  startDate: instantFrom(a, 0), endDate: instantFrom(b, 0), hasTime: true,
}));

const shown = (list) => (list.length
  ? list.map((r) => `${phYmd(r.startDate)}..${phYmd(r.endDate)}`).join('  ')
  : '(nothing to offer)');

export default function run() {
  suite('Offering new dates instead of cancelling');

  group('how long the client gets to decide');
  check('a trip far off gets the full 24 hours', offerDeadline(inDays(5), now).toISOString(), inHours(24).toISOString());
  // The window can never outlive the pickup it is about — nobody should
  // still be deciding at the hour they were meant to collect the vehicle.
  check('a trip in 6 hours gets 6', offerDeadline(inHours(6), now).toISOString(), inHours(6).toISOString());

  group('a pickup too close to arrange anything is refunded outright');
  check('5 hours away, worth offering', hasEnoughNotice(inHours(5), now), true);
  check('2 hours away, not worth it', hasEnoughNotice(inHours(2), now), false);
  check('1 hour away, not worth it', hasEnoughNotice(inHours(1), now), false);

  group('the countdown');
  check('nearly a day', timeLeftLabel(inHours(23.5), now), '23 hours left to decide');
  check('under an hour', timeLeftLabel(inHours(0.67), now), '40 minutes left to decide');
  check('past it', timeLeftLabel(inHours(-1), now), 'Time is up');

  group('an offer only counts while the booking is live');
  const open = { status: 'open', deadline: inHours(3) };
  check('open and in time', isOfferOpen(open, now), true);
  check('open but past the deadline', isOfferOpen({ status: 'open', deadline: inHours(-3) }, now), false);
  check('already answered', isOfferOpen({ status: 'accepted', deadline: inHours(3) }, now), false);
  // Admin can cancel a booking by other routes — a no-show, an approved
  // refund request — without touching the offer on it. A settled booking
  // must never still be presenting a choice, or be refunded a second time.
  check('on a pending booking', bookingAwaitingDecision({ status: 'pending', adjustOffer: open }, now), true);
  check('on a confirmed booking', bookingAwaitingDecision({ status: 'confirmed', adjustOffer: open }, now), true);
  check('on a cancelled booking', bookingAwaitingDecision({ status: 'cancelled', adjustOffer: open }, now), false);
  check('on a completed booking', bookingAwaitingDecision({ status: 'completed', adjustOffer: open }, now), false);

  group('what the client is told');
  check('lost the race', offerReasonText('booking_conflict'), 'Another reservation for this vehicle was confirmed for your dates.');
  check('vehicle pulled', offerReasonText('vehicle_unavailable', 'necessary repairs'), 'This vehicle is unavailable on your dates due to necessary repairs.');
  const message = offerMessage({ reason: 'booking_conflict', carName: 'Honda Civic', totalDays: 7, optionCount: 3, deadlineText: 'Tue, Sep 22, 10:00 AM' });
  check('names the trip', message.includes('7-day trip in the Honda Civic'), true);
  check('names the deadline', message.includes('Tue, Sep 22, 10:00 AM'), true);
  check('and promises the refund', message.includes('refund you automatically'), true);

  group('the dates we look for');
  const booking = { startDate: instantFrom('2026-09-24', 7), endDate: instantFrom('2026-09-26', 7), totalDays: 2, hasPickupTime: true };
  // Closest to the original first, and a later date before an earlier one
  // at the same distance — pushing a trip back is nearly always easier for
  // a client than pulling it forward.
  check('nothing else booked', shown(nearbyRanges(booking, [], now)), '2026-09-25..2026-09-27  2026-09-23..2026-09-25  2026-09-26..2026-09-28');
  check('the winner took Sep 22-27', shown(nearbyRanges(booking, busy(['2026-09-22', '2026-09-27']), now)), '2026-09-27..2026-09-29  2026-09-28..2026-09-30  2026-09-29..2026-10-01');
  check('nothing free for a month', shown(nearbyRanges(booking, busy(['2026-09-01', '2026-11-01']), now)), '(nothing to offer)');
  // Falling through to a plain refund is the right answer when there is
  // genuinely nothing to offer.
  const soon = { startDate: instantFrom('2026-09-22', 7), endDate: instantFrom('2026-09-23', 7), totalDays: 1, hasPickupTime: true };
  check('yesterday is never offered', shown(nearbyRanges(soon, [], now)), '2026-09-23..2026-09-24  2026-09-24..2026-09-25  2026-09-25..2026-09-26');
  check('an offered slot keeps the client\'s own hour', formatPhDateTime(nearbyRanges(booking, [], now)[0].startDate), 'Fri, Sep 25, 2026 · 7:00 AM');

  group('the dates a client paid to move to survive being read back');
  // This is the bug that took a client's money and lost their booking:
  // topUp.option was held by reference and the nested document was then
  // cleared, which empties the reference. The dates were written back as
  // nothing and the save was rejected with "startDate is required" — long
  // after the payment had gone through.
  const id = () => new mongoose.Types.ObjectId();
  const doc = new Booking({
    user: id(),
    car: id(),
    startDate: instantFrom('2026-09-22', 7),
    endDate: instantFrom('2026-09-23', 7),
    hasPickupTime: true,
    totalDays: 1,
    totalPrice: 1800,
    amountPaid: 1800,
    payment: 'paid',
    paymentType: 'full',
    status: 'pending',
    adjustOffer: {
      status: 'open',
      deadline: inHours(6),
      options: [],
      topUp: {
        checkoutSessionId: 'cs_test',
        amount: 200,
        startedAt: now,
        option: {
          startDate: instantFrom('2026-09-26', 7),
          endDate: instantFrom('2026-09-27', 7),
          subtotal: 2000,
          discountAmount: 0,
          totalPrice: 2000,
          promoLabel: '',
        },
      },
    },
  });

  const raw = doc.adjustOffer.topUp.option;
  const option = typeof raw?.toObject === 'function' ? raw.toObject() : { ...raw };
  doc.adjustOffer.topUp = { checkoutSessionId: '', amount: 0, startedAt: null, option: {} };

  check('the dates survive the clear', formatPhDateTime(option.startDate), 'Sat, Sep 26, 2026 · 7:00 AM');
  check('and so does the price', option.totalPrice, 2000);

  doc.startDate = option.startDate;
  doc.endDate = option.endDate;
  doc.totalPrice = option.totalPrice;
  doc.amountPaid += 200;
  check('so the booking still saves', doc.validateSync() ? doc.validateSync().message : 'valid', 'valid');
  check('on the dates they paid for', formatPhDateTime(doc.startDate), 'Sat, Sep 26, 2026 · 7:00 AM');
}
