import mongoose from 'mongoose';

// Somebody who drives for us.
//
// Not a user account. A driver does not log in, has no password and no
// email — they are a name and a number the office rings. Making them
// accounts would mean a login nobody uses, a password to reset and a role
// to guard, all for a record that exists so somebody can be telephoned.
//
// What is deliberately NOT here: licence number, ID, photograph, expiry
// dates. The business keeps that offline. See utils/drivers.js.
const driverSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  // Stored without spaces or dashes so the same person cannot be entered
  // twice in two spellings. Never shown to customers — the booking page
  // lists names only.
  phone: { type: String, required: true },

  // Whether they are driving for us at the moment. This is the standing
  // answer, not a calendar: somebody who has left, or is off indefinitely,
  // stops being offered. Days off and sickness are a separate thing.
  //
  // Turning somebody off rather than deleting them is the usual case: a
  // driver who leaves is still the driver on last month's bookings, and
  // deleting the record would leave those bookings naming nobody.
  active: { type: Boolean, default: true },

  // A face, so a customer waiting outside their house knows who has just
  // pulled up. This one DOES reach customers, unlike the number — it is a
  // staff photograph the driver knows is being shown, not a document.
  //
  // An ID or a licence photograph is a different thing entirely and is
  // still not kept anywhere in this system. See utils/drivers.js.
  image: { type: String, default: '' },
  imageFileId: { type: String, default: '' },

  // What people who have actually been driven by them say.
  //
  // Kept on the driver rather than worked out on every read, the same way a
  // vehicle's rating is: the booking page shows a rating beside every name
  // it offers, and averaging each driver's trips to draw one list would be
  // a query per driver per page load.
  //
  // Recomputed from the bookings whenever one is rated, so it can always be
  // rebuilt and can never drift into being its own version of the truth.
  // See recomputeDriverRating in routes/bookings.js.
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },

  // Days this driver is not available, for a reason that is not a trip:
  // sick, on leave, a rest day, a family thing.
  //
  // Stored as real instants rather than calendar dates, worked out from
  // Philippine midnights when they are written. That keeps the rule that
  // decides who is free free of any timezone thinking — see
  // driverFreeFor in utils/drivers.js, which is plain overlap arithmetic
  // and has no imports to do it with.
  //
  // "Not working" is the other way somebody becomes unavailable, and the
  // two are not the same: that one has no end date and takes them off
  // every list until somebody puts them back.
  blocks: [{
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    reason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],

  // For the office. Never leaves the admin side.
  note: { type: String, default: '' },
}, { timestamps: true });

// Two people called Juan Dela Cruz is ordinary; two records for the same
// mobile is somebody entered twice. The number is what the office actually
// dials, so it is the thing worth keeping unique.
driverSchema.index({ phone: 1 }, { unique: true });

export default mongoose.model('Driver', driverSchema);
