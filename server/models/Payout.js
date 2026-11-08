import mongoose from 'mongoose';

// One payment handed to a vehicle's owner.
//
// Written by admin after the money has already gone — see utils/payouts.js
// for why the system records rather than sends. Everything here is either
// evidence that the payment happened or the trail of what became of it.
//
// Nothing is ever deleted. A mistake is voided, which leaves the row in
// place, struck through, with a reason beside it, and puts the trips it
// covered back into what is owed. The owner saw the original figure; a row
// that simply disappeared would be indistinguishable from one being hidden.
const payoutSchema = new mongoose.Schema({
  consignor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Added up on the server from the trips below, never taken from the
  // browser. An amount posted by a client is a claim about money; the
  // trips are the record of it.
  amount: { type: Number, required: true },

  method: { type: String, enum: ['gcash', 'cash', 'bank'], required: true },

  // The GCash or bank reference. Required for GCash (see payoutProblem),
  // empty for cash, which has no such thing.
  reference: { type: String, default: '' },

  note: { type: String, default: '' },

  // The GCash confirmation screenshot, optional. Signed-link only, like
  // every other document in the system — see the ImageKit routes.
  receipt: {
    url: { type: String, default: '' },
    fileId: { type: String, default: '' },
  },

  // The finished trips this payment settles. Membership of a payout that
  // has not been voided is the ONLY definition of a trip being paid: there
  // is no paid flag on the booking, because two records of one fact drift
  // apart and the one that drifts here is money.
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status: { type: String, enum: ['recorded', 'void'], default: 'recorded', index: true },

  // The owner ticking "I got this". Not required for the payment to count
  // — the money has already moved either way — but it is what turns one
  // person's word into both people's record, and the ones never confirmed
  // are exactly the ones worth asking about.
  confirmedAt: { type: Date, default: null },

  voidedAt: { type: Date, default: null },
  voidReason: { type: String, default: '' },
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Working out what a consignor is still owed reads every live payout of
// theirs, on every load of the admin page and their own dashboard.
payoutSchema.index({ consignor: 1, status: 1 });

export default mongoose.model('Payout', payoutSchema);
