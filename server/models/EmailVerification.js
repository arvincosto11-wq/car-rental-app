import mongoose from 'mongoose';

// One doc per email currently mid-verification. A fresh send-code request
// overwrites any existing doc for that email, invalidating the old code.
// The TTL index below auto-deletes a doc once expiresAt passes — no manual
// cleanup needed.
const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('EmailVerification', emailVerificationSchema);
