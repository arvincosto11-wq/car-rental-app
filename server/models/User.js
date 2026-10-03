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
  // Identity is recorded as facts, never as photographs.
  //
  // This used to hold scans of government IDs and driving licences, front
  // and back, plus a pending copy of each awaiting review. All of it is
  // gone. An ID photo is the raw material for opening accounts in somebody
  // else's name, and a student project on free hosting has no way to detect
  // a breach, let alone answer one. The least dangerous way to hold that
  // data is not to hold it.
  //
  // What stays is what the reminders need: a type, an expiry, a licence
  // number. None of it is worth stealing, and all of it is checked properly
  // at the counter, against the real documents, by somebody looking at the
  // person holding them. That check was always the one doing the work; the
  // upload only ever made it feel verified.
  validIdType: { type: String, default: '' },
  // Not every ID type expires (e.g. TIN ID), so this stays optional —
  // left unset means "doesn't expire" rather than "unknown", and the
  // expiring-documents view (GET /admin/expiring-documents) just skips
  // anyone without one set.
  validIdExpiry: { type: Date },
  // When each expiry-reminder notification was last sent, so the opportunistic
  // check on GET /auth/me (there's no background job on Render's free tier)
  // only re-notifies on a cooldown instead of on every single page load.
  idExpiryNotifiedAt: { type: Date },
  licenseNumber: { type: String, default: '' },
  licenseExpiry: { type: Date },
  licenseExpiryNotifiedAt: { type: Date },
  emergencyContactName: { type: String, default: '' },
  emergencyContactNumber: { type: String, default: '' },
  isBlocked: { type: Boolean, default: false },
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Car' }]
}, { timestamps: true });

export default mongoose.model('User', userSchema);