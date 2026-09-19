import mongoose from 'mongoose';

// "Book N days or more, get P% off" — set by admin, applied automatically.
// Unlike a per-car promo (Car.promo), one rule can cover many vehicles, so
// rules live in their own collection rather than on each car.
//
// appliesTo 'all' is evaluated at booking time, so it also covers vehicles
// added after the rule was created. 'selected' is a fixed list.
const longRentalDiscountSchema = new mongoose.Schema({
  minDays: { type: Number, required: true, min: 2 },
  percent: { type: Number, required: true, min: 1, max: 50 },
  appliesTo: { type: String, enum: ['all', 'selected'], default: 'all' },
  cars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Car' }],
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('LongRentalDiscount', longRentalDiscountSchema);
