// What the office owes somebody an answer on, and what order the work
// comes in. The Pending tab on Manage Bookings is counted with
// needsDecision, so these are the rules behind that number.

import { suite, group, check } from './harness.mjs';
import { needsDecision, bookingPriority, TIER } from '../utils/priority.js';

export default function run() {
  suite('Admin · what needs deciding');

  const now = new Date('2026-10-18T12:00:00Z');

  const booking = (over = {}) => ({
    _id: 'b1',
    status: 'confirmed',
    payment: 'paid',
    createdAt: '2026-10-18T11:00:00Z',
    startDate: '2026-10-18T12:00:00Z',
    endDate: '2026-10-19T12:00:00Z',
    refundStatus: 'none',
    ...over,
  });

  group('three questions, one answer owed');
  check('a booking nobody has confirmed', needsDecision(booking({ status: 'pending' })), true);
  check('a client asking to move their dates',
    needsDecision(booking({ rescheduleRequest: { status: 'pending' } })), true);
  check('a client asking for their money back',
    needsDecision(booking({ refundStatus: 'requested' })), true);

  group('what is not ours to answer');
  // The office already decided when it made the offer; the client holds
  // it now, and it expires on its own.
  check('an offer waiting on the client',
    needsDecision(booking({ adjustOffer: { status: 'open' } })), false);
  check('a confirmed booking', needsDecision(booking()), false);
  check('a finished trip', needsDecision(booking({ status: 'completed' })), false);
  check('a cancellation nobody asked about', needsDecision(booking({ status: 'cancelled' })), false);
  check('a request already answered',
    needsDecision(booking({ rescheduleRequest: { status: 'approved' } })), false);
  check('a refund already paid', needsDecision(booking({ refundStatus: 'approved' })), false);
  check('nothing at all', needsDecision(undefined), false);

  // The Pending tab deliberately overlaps the others. A vehicle going out
  // this evening whose client has asked to move it is BOTH waiting on an
  // answer and genuinely due at the desk — and if answering it took it
  // out of For Pickup, somebody would be left standing at the counter.
  group('a booking can be in two places');
  const dueOutAndAsking = booking({
    startDate: '2026-10-18T12:00:00Z',
    rescheduleRequest: { status: 'pending' },
  });
  check('it wants an answer', needsDecision(dueOutAndAsking), true);
  check('and it is still going out on its original dates',
    dueOutAndAsking.startDate, '2026-10-18T12:00:00Z');

  group('the order the work comes in');
  check('a request sits in the decide tier',
    bookingPriority(booking({ refundStatus: 'requested' }), { now }).tier, TIER.DECIDE);
  // In this tier for sorting, though it is not the office's to answer.
  check('so does an open offer',
    bookingPriority(booking({ adjustOffer: { status: 'open' } }), { now }).tier, TIER.DECIDE);
  check('a vehicle not brought back outranks all of it',
    bookingPriority(booking({ collectedAt: '2026-10-17T12:00:00Z', endDate: '2026-10-17T13:00:00Z' }), { now }).tier,
    TIER.MISSING);
  check('a settled booking is last',
    bookingPriority(booking({ status: 'completed' }), { now }).tier, TIER.DONE);
}
