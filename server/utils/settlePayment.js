// Opening and confirming the GCash payment that settles what a booking
// owes. Server-only: it reaches PayMongo and reads CLIENT_URL, neither of
// which belongs in a browser. The rule for WHAT is payable lives in
// settlement.js, which is shared with the client so the page can show the
// same figure this charges.
import { payableNow, applyPayment } from './settlement.js';
import Car from '../models/Car.js';
import { createGcashCheckout, paymongoFetch } from './paymongo.js';
import { notifyAdmins } from './notify.js';

const CLIENT_URL = process.env.CLIENT_URL || 'https://rent-a-ride-albay.vercel.app';
// How long a started payment holds off being treated as abandoned.
const PAYMENT_GRACE_MINUTES = 30;

const clearPending = (booking) => {
  booking.pendingSettlement = { checkoutSessionId: '', amount: 0, startedAt: null };
};

export async function startSettlement(booking) {
  const due = payableNow(booking);
  if (due.amount <= 0) return { ok: false, message: 'There is nothing left to pay on this booking.' };

  const car = await Car.findById(booking.car).select('brand model');
  const what = [
    due.balance > 0 && 'balance',
    due.lateFee > 0 && 'late fee',
    due.fuel > 0 && 'fuel',
  ].filter(Boolean).join(' and ');

  const { id, checkoutUrl } = await createGcashCheckout({
    amount: due.amount,
    name: `${car ? `${car.brand} ${car.model}` : 'Vehicle'} — ${what}`,
    description: `Booking ${booking._id} settlement`,
    reference: `${booking._id}-settle-${Date.now()}`,
    metadata: { bookingId: booking._id.toString(), kind: 'settlement' },
    successUrl: `${CLIENT_URL}/my-bookings?settle=success&bookingId=${booking._id}`,
    cancelUrl: `${CLIENT_URL}/my-bookings?settle=cancelled&bookingId=${booking._id}`,
  });

  booking.pendingSettlement = { checkoutSessionId: id, amount: due.amount, startedAt: new Date() };
  await booking.save();
  return { ok: true, checkoutUrl };
}

export async function confirmSettlement(booking) {
  const pending = booking.pendingSettlement;
  if (!pending?.checkoutSessionId) return { ok: false, message: 'There is no payment waiting on this booking.' };

  const session = await paymongoFetch(`/checkout_sessions/${pending.checkoutSessionId}`);
  const paid = (session.data.attributes.payments || []).find((p) => p.attributes?.status === 'paid');

  if (!paid) {
    const age = Date.now() - new Date(pending.startedAt || 0).getTime();
    // Still inside the window they might be paying in — leave it alone
    // rather than clearing a payment somebody is in the middle of making.
    if (age < PAYMENT_GRACE_MINUTES * 60 * 1000) {
      return { ok: false, message: 'That payment has not come through yet.' };
    }
    clearPending(booking);
    await booking.save();
    return { ok: false, message: 'That payment was not completed. You can try again.' };
  }

  // Already recorded — they came back to the page a second time.
  if ((booking.extraPayments || []).some((p) => p.paymongoPaymentId === paid.id)) {
    return { ok: true, booking };
  }

  // Recorded before it is applied, so the money is on the booking — and
  // therefore refundable through paymentSources — whatever happens next.
  booking.extraPayments.push({ paymongoPaymentId: paid.id, amount: pending.amount, paidAt: new Date() });
  const { settled, overpaid } = applyPayment(booking, pending.amount);
  clearPending(booking);
  await booking.save();

  if (overpaid > 0) {
    // The counter took the same money while they were at GCash. Nothing
    // here can hand it back on its own, so it is put in front of a person
    // rather than left as a quiet surplus.
    await notifyAdmins(
      'Client overpaid — refund needed',
      `A client paid ₱${overpaid.toLocaleString()} more than this booking owed, `
      + 'because it was settled at the counter while they were paying. Please refund the difference.',
      '/admin/manage-bookings',
    );
  }

  return { ok: true, booking, settled, overpaid };
}
