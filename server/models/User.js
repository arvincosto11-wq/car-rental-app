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
  // The licence stays, because driving a vehicle you do not hold a licence
  // for is a different kind of problem from a lapsed ID — and the self-drive
  // gate needs a date to compare against.
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