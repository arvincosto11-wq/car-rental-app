import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  // Whether startDate/endDate carry a real pickup time, or are the old
  // date-only form. Every booking made before pickup times existed sits at
  // UTC midnight and means a whole calendar day, so it must not be shown as
  // a "12:00 AM pickup" — see utils/phTime.js. The return is always the
  // same hour as the pickup, so one flag covers both ends.
  hasPickupTime: { type: Boolean, default: false },
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
  // When the keys actually changed hands, recorded by admin at the counter.
  // Before this existed the system inferred it from the clock — "the pickup
  // hour has passed, so they must have it" — which is wrong for anybody
  // running late and wrong for anybody who never turned up at all. Null
  // means not collected yet, not "unknown": utils/backfillCollected.js
  // filled it in for everything that predates the field.
  collectedAt: { type: Date, default: null },
  // And when it came back. Collected with no return is the whole definition
  // of a vehicle that is still out @ past its return date, that is a car
  // nobody can book and nobody knew was missing.
  returnedAt: { type: Date, default: null },
  // The Philippine calendar day the client was last told they are overdue.
  // The sweep runs on every admin page load, so without this they would be
  // emailed on every refresh.
  overdueNotifiedOn: { type: String, default: '' },
  // And the day they were reminded it is due back soon. Cheaper than any
  // fine: most late returns are somebody who lost track of the day, not
  // somebody chancing it.
  dueSoonNotifiedOn: { type: String, default: '' },
  // And the day this booking was warned that the vehicle it is waiting for
  // has not come back yet. Kept on the booking that is about to be let down,
  // not on the one that is late.
  delayWarnedOn: { type: String, default: '' },
  // The last thing a person did to this booking, and who. Position in the
  // lists is decided by urgency, not by recency — a booking moved for March
  // should not outrank today's pickup just because somebody touched it — so
  // a change needs to announce itself where it sits instead.
  //
  // Deliberately not Mongoose's own updatedAt: sweeps write to bookings all
  // the time, and "the server restarted" is not news.
  lastActivity: {
    at: { type: Date, default: null },
    by: { type: String, enum: ['client', 'admin', ''], default: '' },
    what: { type: String, default: '' },
  },
  // What being late cost them, worked out when the vehicle came back. Kept
  // apart from totalPrice on purpose: that figure is what the rental was
  // sold for, and rewriting it afterwards would make every past booking's
  // price a thing that could still change. This is a separate debt — see
  // utils/overdueReturns.js for the sum, which is the terms' own.
  lateFee: {
    days: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    collectedAt: { type: Date, default: null },
    // Lateness already paid for by extending. Without this, extending would
    // move the return date into the future and the days somebody was
    // already late would simply vanish @ making an extension the cheapest
    // way to dodge the fine rather than the honest way to put it right.
    carriedDays: { type: Number, default: 0 },
    carriedAmount: { type: Number, default: 0 },
  },
  // The gauge when the keys went over and when they came back, in eighths
  // of a tank — see utils/fuel.js. Null means nobody read it, which is not
  // the same as empty and must never be charged for. The charge is typed
  // rather than worked out, because section 5 of the terms names no rate:
  // fuel costs what fuel costs, and only whoever buys it knows.
  fuel: {
    atPickup: { type: Number, default: null },
    atReturn: { type: Number, default: null },
    charge: { type: Number, default: 0 },
    collectedAt: { type: Date, default: null },
  },
  // What the vehicle looked like at each end. Section 4 makes the renter
  // liable for damage during the rental, which was unarguable in principle
  // and unprovable in practice — nothing recorded the state it left in, so
  // "it was already like that" was a claim nobody could answer. The charge
  // is typed for the same reason the fuel one is: a repair costs what the
  // shop charges, and no clause names a rate.
  condition: {
    atPickup: { photos: [{ type: String }], note: { type: String, default: '' } },
    atReturn: { photos: [{ type: String }], note: { type: String, default: '' } },
    damageCharge: { type: Number, default: 0 },
    damageCollectedAt: { type: Date, default: null },
  },
  // Highest escalation already sent to admin about this booking sitting
  // unconfirmed — see utils/pendingReminders.js. Stored so each tier fires
  // once rather than on every request that triggers the sweep.
  // Why admin cancelled this, which is also what decided the refund — see
  // refundAmountFor in utils/cancelBooking.js. Empty on client-cancelled
  // and on everything cancelled before this existed.
  // 'other' is no longer a choice anyone can make — it let an admin type
  // any amount, which made the cancel dialog's promise that the reason
  // decides the refund untrue. Kept in the enum so bookings already
  // cancelled that way still load.
  cancelReason: { type: String, enum: ['vehicle_unavailable', 'client_requested', 'terms_not_met', 'breakdown', 'breakdown_client', 'other', ''], default: '' },
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
    // Other vehicles, on the dates they already have. Offered because the
    // dates option is worthless in the case it matters most: when a car is
    // off the road there are no free dates on it, so "same car, other days"
    // always comes back empty and everybody gets cancelled.
    //
    // Only ever vehicles at the same price or cheaper, with the difference
    // refunded. Our vehicle failed, so nobody is asked to pay more because
    // of it, and no price negotiation happens over a notification.
    //
    // Brand, model and image are copied rather than looked up, so the offer
    // shows what it showed when it was made even if the car is edited after.
    vehicleOptions: [{
      car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
      brand: { type: String, default: '' },
      model: { type: String, default: '' },
      image: { type: String, default: '' },
      pricePerDay: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      totalPrice: { type: Number, default: 0 },
      promoLabel: { type: String, default: '' },
      refundDifference: { type: Number, default: 0 },
    }],
    deadline: { type: Date },
    offeredAt: { type: Date },
    resolvedAt: { type: Date },
    // A GCash payment in flight for the difference, when the client had
    // already settled this booking in full and the dates they chose cost
    // more. The dates don't move until it lands — see startTopUp and
    // confirmTopUp in utils/adjustOffer.js.
    topUp: {
      checkoutSessionId: { type: String, default: '' },
      amount: { type: Number, default: 0 },
      startedAt: { type: Date },
      option: {
        startDate: { type: Date },
        endDate: { type: Date },
        subtotal: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
        promoLabel: { type: String, default: '' },
      },
    },
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
  // Each time this booking was made longer. Kept so the breakdown still
  // reads afterwards — a 7-day booking that began as 5 is not the same
  // thing as one booked as 7, and the difference shows in what was paid
  // when. previousEndDate is what it ran to before that extension.
  extensions: [{
    days: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    previousEndDate: { type: Date },
    addedAt: { type: Date },
  }],
  // A GCash payment in flight for an extension. The dates do not move
  // until it lands, so backing out of the payment changes nothing — see
  // utils/extendBooking.js.
  pendingExtension: {
    checkoutSessionId: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    startedAt: { type: Date },
    days: { type: Number, default: 0 },
    endDate: { type: Date },
    totalDays: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    promoLabel: { type: String, default: '' },
    // The lateness this extension settles, held here until the money lands
    // so that abandoning the payment leaves the fine exactly where it was.
    lateDays: { type: Number, default: 0 },
    lateAmount: { type: Number, default: 0 },
  },
  // Further GCash payments taken on this booking after the first — at the
  // moment only the difference when a client moves to dates a promo
  // doesn't reach. A refund can't be taken from a payment that never held
  // the money, so refundBookingPayment works through these in turn.
  extraPayments: [{
    paymongoPaymentId: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    paidAt: { type: Date },
  }],
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