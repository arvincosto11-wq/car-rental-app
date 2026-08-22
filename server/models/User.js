import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  image: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  validIdImage: { type: String, default: '' },
  validIdImageFileId: { type: String, default: '' },
  licenseNumber: { type: String, default: '' },
  licenseExpiry: { type: Date },
  emergencyContactName: { type: String, default: '' },
  emergencyContactNumber: { type: String, default: '' },
  idVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('User', userSchema);