import Booking from '../models/Booking.js';

// Bookings that predate Booking.collectedAt have no record of the handover,
// and the rule they were written under was "the pickup time has passed, so
// the client has it". Reading them under the new rule would silently say
// nobody ever collected anything — so they are given the answer the old rule
// would have given, once.
//
// The cutoff is what keeps this safe to run on every boot, which matters on
// Render's free tier where the server sleeps and restarts often. Only
// bookings made before the field existed are ever touched, so a genuine
// no-show made after this ships can never be quietly marked collected by a
// restart. In time it matches nothing and costs one indexed query.
const FIELD_ADDED_AT = new Date('2026-09-23T00:00:00+08:00');

export default async function backfillCollected() {
  try {
    const result = await Booking.updateMany(
      {
        collectedAt: null,
        createdAt: { $lt: FIELD_ADDED_AT },
        status: { $in: ['confirmed', 'completed'] },
        startDate: { $lte: new Date() },
      },
      // An aggregation pipeline update, so each booking gets its own start
      // date rather than one shared timestamp — the old rule's answer to
      // "when did they collect it?" was always "at the pickup time".
      [{ $set: { collectedAt: '$startDate' } }]
    );
    // And the other half of the record. Every path that completes a booking
    // now stamps returnedAt as it does so, so a completed booking without
    // one can only predate the field — which makes this safe to run on every
    // boot with no cutoff, and safe to run twice.
    //
    // Without it a finished trip showed "Picked up" and nothing else, which
    // reads as a vehicle that never came back.
    const returns = await Booking.updateMany(
      { status: 'completed', returnedAt: null },
      [{ $set: { returnedAt: '$endDate' } }]
    );
    if (returns.modifiedCount) {
      console.log(`📋 Recorded return on ${returns.modifiedCount} booking(s) completed before it was tracked`);
    }

    if (result.modifiedCount) {
      console.log(`📋 Recorded handover on ${result.modifiedCount} booking(s) made before it was tracked`);
    }
  } catch (err) {
    // Never worth refusing to start the server over. Anything missed here
    // is one button press in Manage Bookings.
    console.error('Backfill of collectedAt failed:', err.message);
  }
}
