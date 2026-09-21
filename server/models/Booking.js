import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  // What's actually owed, after any promo discount. Everything else that
  // talks about money (amountPaid, refunds, the paid-in-full check) reads
  // this, so it keeps meaning exactly what it always meant.
  totalPrice: { type: Number, required: true },
  // The promo that was live when this booking was made, copied here rather
  // than read back off the car. The car's promo can be edited or cleared at
  // any time; this receipt can't change. All three stay at their defaults
  // for bookings made without a promo.
  subtotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  promoLabel: { type: String, default: '' },
  amountPaid: { type: Number, required: true },
  paymentType: { type: String, enum: ['downpayment', 'full'], default: 'downpayment' },
  bookingType: { type: String, enum: ['self-drive', 'with-driver'], default: 'with-driver' },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  // Highest escalation already sent to admin about this booking sitting
  // unconfirmed — see utils/pendingReminders.js. Stored so each tier fires
  // once rather than on every request that triggers the sweep.
  // Why admin cancelled this, which is also what decided the refund — see
  // refundAmountFor in utils/cancelBooking.js. Empty on client-cancelled
  // and on everything cancelled before this existed.
  cancelReason: { type: String, enum: ['vehicle_unavailable', 'client_requested', 'other', ''], default: '' },
  cancelNote: { type: String, default: '' },
  confirmReminderTier: { type: Number, default: 0 },
  refundStatus: { type: String, enum: ['none', 'requested', 'approved', 'declined'], default: 'none' },
  refundReason: { type: String, default: '' },
  // Locked in at request time based on how far out the pickup date was —
  // see getRefundPercentage in routes/bookings.js. Not recomputed later,
  // so a slow admin approval can't shrink what the client was promised.
  refundAmount: { type: Number, default: 0 },
  rescheduleRequest: {
    status: { type: String, enum: ['none', 'pending', 'approved', 'declined'], default: 'none' },
    newStartDate: { type: Date },
    newEndDate: { type: Date },
    reason: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    requestedAt: { type: Date },
  },
  // A booking that can't go ahead on its original dates — because another
  // reservation was confirmed over it, or because the vehicle was pulled —
  // is NOT cancelled outright any more. The client is offered the nearest
  // dates we can actually honour, against a full refund, and gets until
  // `deadline` to pick one. Silence refunds them (see utils/adjustOffer.js).
  //
  // Each option carries its own price because a date-window promo may not
  // reach the new dates. The trip length never changes, so the long-rental
  // discount can't move and there's never a balance to settle beyond the
  // one the client already brings at pickup.
  adjustOffer: {
    status: { type: String, enum: ['none', 'open', 'accepted', 'declined', 'expired'], default: 'none' },
    reason: { type: String, enum: ['booking_conflict', 'vehicle_unavailable', ''], default: '' },
    // The client-safe phrase that follows "unavailable due to" — never the
    // admin's private note. Empty for a booking_conflict offer.
    cause: { type: String, default: '' },
    options: [{
      startDate: { type: Date },
      endDate: { type: Date },
      subtotal: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      totalPrice: { type: Number, default: 0 },
      promoLabel: { type: String, default: '' },
    }],
    deadline: { type: Date },
    offeredAt: { type: Date },
    resolvedAt: { type: Date },
  },
  // 'offline' = pay in person (cash/GCash, unverified), 'paid' = settled
  // (either the existing "paid in full" assumption, or a verified online
  // GCash payment), 'gcash_pending' = checkout session created, awaiting
  // the client to actually complete it on PayMongo's page.
  payment: { type: String, default: 'offline' },
  paymongoCheckoutSessionId: { type: String, default: '' },
  // PayMongo's own payment id (e.g. pay_xxx) once the GCash payment succeeds
  // — this is the reference to quote when looking a transaction up in the
  // PayMongo dashboard or contacting their support, since GCash's own
  // internal reference isn't exposed to merchants.
  paymongoPaymentId: { type: String, default: '' },
  // Set once a refund is actually issued through PayMongo (not just marked
  // approved in our own status) — see refundBookingPayment in
  // utils/paymongo.js. Status is whatever PayMongo returns immediately
  // (e.g. 'pending' or 'succeeded'); not tracked further via webhook yet.
  paymongoRefundId: { type: String, default: '' },
  paymongoRefundStatus: { type: String, default: '' },
  carRating: {
    vehicleCondition: { type: Number, min: 1, max: 5 },
    serviceQuality: { type: Number, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: '' },
    photos: [{ url: String, fileId: String }],
    hidden: { type: Boolean, default: false },
    ratedAt: { type: Date },
    updatedAt: { type: Date },
  },
  clientRating: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: '' },
    ratedAt: { type: Date },
    updatedAt: { type: Date },
  },
}, { timestamps: true });

export default mongoose.model('Booking', bookingSchema);