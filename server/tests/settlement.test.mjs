// What a client can still pay online, and what the money closes when it
// lands. The amount is always the server's, never the page's.

import { suite, group, check } from './harness.mjs';
import { payableNow, applyPayment } from '../utils/settlement.js';

export default function run() {
  suite('Client · settling what is owed');

  const at = new Date('2026-10-18T12:00:00Z');

  const booking = (over = {}) => ({
    status: 'confirmed',
    payment: 'paid',
    totalPrice: 2000,
    amountPaid: 400,
    ...over,
  });

  group('what can be paid');
  check('a balance after a deposit', payableNow(booking()).amount, 1600);
  check('nothing once it is paid in full', payableNow(booking({ amountPaid: 2000 })).amount, 0);

  const charged = booking({
    status: 'completed',
    amountPaid: 2000,
    lateFee: { days: 1, amount: 2000 },
    fuel: { charge: 350 },
  });
  check('charges a trip ended with', payableNow(charged).amount, 2350);
  check('broken down', [payableNow(charged).lateFee, payableNow(charged).fuel].join(','), '2000,350');
  check('a charge the counter already took drops out',
    payableNow({ ...charged, fuel: { charge: 350, collectedAt: at } }).amount, 2000);

  group('what cannot');
  // Damage is settled with the vehicle in front of both parties.
  check('damage is never payable from the page',
    payableNow({ ...charged, condition: { damageCharge: 5000 } }).amount, 2350);
  // An unfinished checkout is its own flow: they resume the original
  // payment rather than settling anything.
  check('a checkout nobody finished', payableNow(booking({ payment: 'gcash_pending' })).amount, 0);
  check('a cancelled booking', payableNow(booking({ status: 'cancelled' })).amount, 0);
  check('one the office has not confirmed', payableNow(booking({ status: 'pending' })).amount, 0);
  check('nothing at all', payableNow(undefined).amount, 0);

  group('what the money closes');
  const b1 = booking();
  const r1 = applyPayment(b1, 1600, at);
  check('a balance is paid off', b1.amountPaid, 2000);
  check('and says so', r1.settled.join(','), 'balance');
  check('with nothing spare', r1.overpaid, 0);

  const b2 = { ...charged, lateFee: { ...charged.lateFee }, fuel: { ...charged.fuel } };
  const r2 = applyPayment(b2, 2350, at);
  check('both charges close together', r2.settled.join(','), 'lateFee,fuel');
  check('the late fee is stamped', !!b2.lateFee.collectedAt, true);
  check('so is the fuel', !!b2.fuel.collectedAt, true);

  // A charge only closes if the money covers it. Half a late fee leaves
  // it open rather than marking it settled for less than it is.
  const b3 = { ...charged, lateFee: { ...charged.lateFee }, fuel: { ...charged.fuel } };
  const r3 = applyPayment(b3, 1000, at);
  check('half a charge settles nothing', r3.settled.length, 0);
  check('and the charge stays open', !!b3.lateFee.collectedAt, false);

  // The counter can take the same money while a client stands at GCash.
  group('when the counter gets there first');
  const b4 = booking({ amountPaid: 2000 });
  const r4 = applyPayment(b4, 1600, at);
  check('there is nothing left to close', r4.settled.length, 0);
  check('and the overpayment is reported', r4.overpaid, 1600);
}
