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

// Actually reverses a booking's GCash charge through PayMongo — used
// whenever a refund is approved (by an admin, or automatically when a
// double-booking conflict cancels a pending request). Mutates the booking
// in place with the resulting refund id/status; caller is responsible for
// saving it. No-ops (returns null) if there's no real payment behind the
// booking to refund.
export async function refundBookingPayment(booking) {
  if (!booking.paymongoPaymentId || !booking.refundAmount) return null;

  const refund = await paymongoFetch('/refunds', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(booking.refundAmount * 100),
          payment_id: booking.paymongoPaymentId,
          reason: 'requested_by_customer',
          notes: (booking.refundReason || '').slice(0, 255),
        },
      },
    }),
  });

  booking.paymongoRefundId = refund.data.id;
  booking.paymongoRefundStatus = refund.data.attributes.status;
  return refund;
}
