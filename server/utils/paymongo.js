const PAYMONGO_API = 'https://api.paymongo.com/v1';

function paymongoAuthHeader() {
  return 'Basic ' + Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');
}

export async function paymongoFetch(path, options = {}) {
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: paymongoAuthHeader(),
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.errors?.[0]?.detail || 'PayMongo request failed');
  }
  return json;
}

// A PayMongo-hosted GCash checkout. Nothing about the payer's account ever
// touches our own server — we hand PayMongo an amount and a pair of return
// URLs and send the client to them.
export async function createGcashCheckout({ amount, name, description, reference, metadata, successUrl, cancelUrl }) {
  const session = await paymongoFetch('/checkout_sessions', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ amount: Math.round(amount * 100), currency: 'PHP', name, quantity: 1 }],
          payment_method_types: ['gcash'],
          description,
          reference_number: reference,
          metadata,
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      },
    }),
  });
  return { id: session.data.id, checkoutUrl: session.data.attributes.checkout_url };
}

// Every GCash payment this booking has taken, largest source first. A
// refund is always taken from a specific payment and can't exceed it, so a
// booking that was topped up has to be unwound across both.
//
// The first payment's size isn't stored anywhere, but it doesn't need to
// be: it's whatever the total collected is, less the top-ups we do know.
export const paymentSources = (booking) => {
  const extras = (booking.extraPayments || []).filter((p) => p.paymongoPaymentId && p.amount > 0);
  const extraTotal = extras.reduce((sum, p) => sum + p.amount, 0);
  return [
    { paymongoPaymentId: booking.paymongoPaymentId, amount: Math.max(booking.amountPaid - extraTotal, 0) },
    ...extras,
  ].filter((p) => p.paymongoPaymentId && p.amount > 0);
};

// Actually reverses a booking's GCash charge through PayMongo — used
// whenever a refund is approved (by an admin, or automatically when a
// double-booking conflict cancels a pending request). Mutates the booking
// in place with the resulting refund id/status; caller is responsible for
// saving it. No-ops (returns null) if there's no real payment behind the
// booking to refund.
export async function refundBookingPayment(booking) {
  if (!booking.refundAmount) return null;
  const sources = paymentSources(booking);
  if (!sources.length) return null;

  let outstanding = booking.refundAmount;
  let first = null;

  for (const source of sources) {
    if (outstanding <= 0) break;
    const take = Math.min(outstanding, source.amount);
    const refund = await paymongoFetch('/refunds', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(take * 100),
            payment_id: source.paymongoPaymentId,
            reason: 'requested_by_customer',
            notes: (booking.refundReason || '').slice(0, 255),
          },
        },
      }),
    });
    outstanding -= take;
    // The client sees one reference, so it's the first one — the others
    // are only ever needed when reading the PayMongo dashboard, where
    // they sit against the same booking.
    if (!first) first = refund;
  }

  if (!first) return null;
  booking.paymongoRefundId = first.data.id;
  booking.paymongoRefundStatus = first.data.attributes.status;
  return first;
}
