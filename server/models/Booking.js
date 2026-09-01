import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  paymentType: { type: String, enum: ['downpayment', 'full'], default: 'downpayment' },
  bookingType: { type: String, enum: ['self-drive', 'with-driver'], default: 'with-driver' },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
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
  payment: { type: String, default: 'offline' },
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