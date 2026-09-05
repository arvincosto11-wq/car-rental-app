import express from 'express';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import { protect } from '../middleware/auth.js';
import { notifyUser } from '../utils/notify.js';
import { paymongoFetch } from '../utils/paymongo.js';

const router = express.Router();

const CLIENT_URL = process.env.CLIENT_URL || 'https://rent-a-ride-albay.vercel.app';

// Client starts an online GCash payment for a booking they already created
// (status 'pending', payment 'gcash_pending'). Returns a PayMongo-hosted
// checkout URL — no card/GCash details ever touch our own server.
router.post('/gcash/checkout-session', protect, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId).populate('car', 'brand model');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (booking.payment === 'paid') {
      return res.status(400).json({ message: 'This booking is already paid.' });
    }

    const amountCentavos = Math.round(booking.amountPaid * 100);
    const session = await paymongoFetch('/checkout_sessions', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{
              amount: amountCentavos,
              currency: 'PHP',
              name: `${booking.car?.brand || ''} ${booking.car?.model || ''} booking`.trim() || 'Vehicle booking',
              quantity: 1,
            }],
            payment_method_types: ['gcash'],
            description: `Booking ${booking._id}`,
            reference_number: booking._id.toString(),
            metadata: { bookingId: booking._id.toString() },
            success_url: `${CLIENT_URL}/my-bookings?gcash=success&bookingId=${booking._id}`,
            cancel_url: `${CLIENT_URL}/my-bookings?gcash=cancelled&bookingId=${booking._id}`,
          },
        },
      }),
    });

    booking.paymongoCheckoutSessionId = session.data.id;
    booking.payment = 'gcash_pending';
    await booking.save();

    res.json({ checkoutUrl: session.data.attributes.checkout_url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Re-checks the real payment status directly against PayMongo, rather than
// trusting any single webhook payload's shape — this is the authoritative
// path. The webhook (below) is just a best-effort trigger for the same
// check, for the case where a client pays and closes the tab without
// coming back to the site.
async function reconcileBookingPayment(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking || !booking.paymongoCheckoutSessionId) return null;

  const session = await paymongoFetch(`/checkout_sessions/${booking.paymongoCheckoutSessionId}`);
  const payments = session.data.attributes.payments || [];
  const paidPayment = payments.find((p) => p.attributes?.status === 'paid');

  if (paidPayment && booking.payment !== 'paid') {
    booking.payment = 'paid';
    // PayMongo's own payment id — the reference to quote for this
    // transaction, since GCash's own internal reference isn't exposed to
    // merchants through the API.
    booking.paymongoPaymentId = paidPayment.id;
    await booking.save();
    await notifyUser(booking.user, 'Payment Received', 'Your GCash payment was received. Your booking is still awaiting admin confirmation.', '/my-bookings');
  } else if (!paidPayment && booking.payment === 'gcash_pending') {
    // They backed out of the GCash page or it expired.
    booking.payment = 'offline';
    await booking.save();
  }
  return booking;
}

// Client lands back on My Bookings after the PayMongo redirect (success or
// cancel) — check the real status immediately instead of waiting on the
// webhook, which can lag by a few seconds.
router.get('/gcash/status/:bookingId', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updated = await reconcileBookingPayment(req.params.bookingId);
    res.json({ payment: updated ? updated.payment : booking.payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verifies a PayMongo webhook signature exactly the way PayMongo's own
// paymongo-node SDK does it (Paymongo-Signature: "t=...,te=...,li=...",
// HMAC-SHA256 of "{timestamp}.{rawBody}", hex digest).
export function constructPaymongoEvent(rawBody, signatureHeader, secret) {
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});
  const { t: timestamp, te: testSig, li: liveSig } = parts;
  const comparisonSignature = liveSig || testSig;
  if (!timestamp || !comparisonSignature) {
    throw new Error('Malformed PayMongo signature header');
  }

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${bodyStr}`).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(comparisonSignature);
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error('Invalid PayMongo webhook signature');
  }
  return JSON.parse(bodyStr);
}

// Mounted separately in index.js with express.raw() so we get the exact
// raw bytes PayMongo signed — express.json() would re-serialize the body
// and break signature verification.
export async function handlePaymongoWebhook(req, res) {
  try {
    const signatureHeader = req.headers['paymongo-signature'];
    if (!signatureHeader) return res.status(400).json({ message: 'Missing signature' });

    const event = constructPaymongoEvent(req.body, signatureHeader, process.env.PAYMONGO_WEBHOOK_SECRET);
    const eventType = event?.data?.attributes?.type || '';
    const resource = event?.data?.attributes?.data;

    if (eventType.includes('paid')) {
      const bookingId = resource?.attributes?.metadata?.bookingId || resource?.attributes?.reference_number;
      if (bookingId) {
        await reconcileBookingPayment(bookingId).catch((err) => console.error('PayMongo webhook reconcile failed:', err.message));
      } else {
        console.log('PayMongo webhook: could not find a bookingId in event type', eventType, JSON.stringify(event).slice(0, 800));
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayMongo webhook error:', err.message);
    res.status(400).json({ message: err.message });
  }
}

export default router;
