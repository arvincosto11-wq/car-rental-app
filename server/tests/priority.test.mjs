// What the office owes somebody an answer on, and what order the work
// comes in. The Pending tab on Manage Bookings is counted with
// needsDecision, so these are the rules behind that number.

import { suite, group, check } from './harness.mjs';
import { needsDecision, refundOwed, bookingPriority, TIER } from '../utils/priority.js';
import { paymentSources } from '../utils/paymongo.js';

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

  // Approving a refund sends it back through GCash and records the payout
  // on the booking. A failure recorded nothing — one notification, and a
  // booking still reading "approved" exactly like the ones that worked.
  group('a refund the client never received');
  const paid = (over = {}) => booking({
    status: 'cancelled',
    refundStatus: 'approved',
    refundAmount: 2000,
    amountPaid: 2000,
    paymongoPaymentId: 'pay_abc',
    ...over,
  });
  check('approved, money taken, nothing sent', refundOwed(paid()), true);
  check('so it is waiting on the office', needsDecision(paid()), true);
  check('a payout that went through is settled',
    refundOwed(paid({ paymongoRefundId: 're_abc' })), false);
  check('and so is one paid back by hand',
    refundOwed(paid({ refundSettledByHand: { at: '2026-10-18T12:00:00Z' } })), false);

  // The half that stops this flagging every abandoned checkout: a refund
  // approved against a payment nobody ever captured owes nothing.
  check('a checkout nobody finished owes nothing',
    refundOwed(paid({ paymongoPaymentId: '', amountPaid: 0, payment: 'gcash_pending' })), false);
  check('nor does a refund of nothing', refundOwed(paid({ refundAmount: 0 })), false);
  check('nor one still being decided', refundOwed(paid({ refundStatus: 'requested' })), false);
  check('nor one turned down', refundOwed(paid({ refundStatus: 'declined' })), false);
  // A later payment can be the only one that held money.
  check('a top-up counts as money taken',
    refundOwed(paid({
      paymongoPaymentId: '', amountPaid: 0,
      extraPayments: [{ paymongoPaymentId: 'pay_top', amount: 500 }],
    })), true);

  // priority.js cannot import paymongo.js — that file carries the API
  // credentials and is server-only, while this one is copied to the
  // client. So it mirrors paymentSources, and this pins the two together.
  group('and it agrees with the file that actually sends the money');
  for (const [what, b] of [
    ['a normal payment', paid()],
    ['nothing captured', paid({ paymongoPaymentId: '', amountPaid: 0 })],
    ['a top-up only', paid({
      paymongoPaymentId: '', amountPaid: 500,
      extraPayments: [{ paymongoPaymentId: 'pay_top', amount: 500 }],
    })],
    ['an id but no money', paid({ amountPaid: 0 })],
  ]) {
    check(what, refundOwed({ ...b, refundAmount: 2000 }) === (paymentSources(b).length > 0), true);
  }

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
