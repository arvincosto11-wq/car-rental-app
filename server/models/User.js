import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'consignor'], default: 'user' },
  image: { type: String, default: '' },
  imageFileId: { type: String, default: '' },
  // Set once at registration and never user-editable afterward (see PUT
  // /auth/me) — it has to match the birthdate on the user's own valid ID,
  // so letting them freely change it would defeat both the 18+ age check
  // at signup and identity verification against their uploaded ID.
  birthDate: { type: Date },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  // The only identity document this system records is a driving licence,
  // and only as a number and a date.
  //
  // This used to hold scans of government IDs and driving licences, front
  // and back, plus a pending copy of each awaiting review. All of it is
  // gone. An ID photo is the raw material for opening accounts in somebody
  // else's name, and a student project on free hosting has no way to detect
  // a breach, let alone answer one. The least dangerous way to hold that
  // data is not to hold it.
  //
  // The valid ID went the same way as the photographs, and for the same
  // reason: a type and an expiry that somebody typed about their own papers
  // proved nothing, and asking for them at registration was friction in
  // exchange for a reminder nobody needed. Two valid IDs are checked at the
  // counter, against the person holding them. That was always the check
  // doing the work.
  //
  // What remains of the licence is its expiry, and only that. The number
  // went the way of the ID for the same reason: it identifies a person and a
  // date does not, and the card itself is read at the counter. The date is
  // here because the self-drive gate needs something to compare a trip
  // against, and because a renewal reminder is worth sending.
  licenseExpiry: { type: Date },
  licenseExpiryNotifiedAt: { type: Date },
  emergencyContactName: { type: String, default: '' },
  emergencyContactNumber: { type: String, default: '' },
  // When the password was last changed, so Account Settings can say so.
  // Null means it has never been changed since the account was made, which
  // the screen says plainly rather than guessing a date.
  passwordChangedAt: { type: Date, default: null },
  isBlocked: { type: Boolean, default: false },
  // Why, and since when. A block used to be a bare yes/no, so a client who
  // could not book had no record saying what they had done — and the admin
  // who blocked them was the only person who knew. An owner's contract
  // hold has always carried its reason; this brings the two level.
  blockedAt: { type: Date, default: null },
  blockReason: { type: String, default: '' },

  // A vehicle owner whose contract is on hold.
  //
  // Not a deletion and not a block: they can still sign in, see their
  // vehicles and their history, and read why. What stops is the business —
  // no new vehicles, no new inspections, no asking for dates. Deleting
  // them instead would leave their name on every past booking of their
  // cars and make the records stop making sense.
  //
  // `at` being set is what suspended means; the reason is shown to them,
  // so it is written for them to read rather than as an internal note.
  suspension: {
    at: { type: Date, default: null },
    reason: { type: String, default: '' },
  },
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Car' }]
}, { timestamps: true });

export default mongoose.model('User', userSchema);