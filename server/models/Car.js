import mongoose from 'mongoose';

const carSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  pricePerDay: { type: Number, required: true },
  category: { type: String, enum: ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Coupe', 'Motorcycle'] },
  transmission: { type: String, enum: ['Automatic', 'Manual', 'Semi-Automatic'] },
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] },
  seats: { type: Number, required: true },
  availableBookingTypes: { type: [String], enum: ['self-drive', 'with-driver'], default: ['self-drive', 'with-driver'] },
  description: { type: String, default: '' },
  // Not required at the schema level (would break saves on cars added
  // before this field existed) — plate number is enforced in the Add
  // Vehicle form instead for anything created going forward.
  plateNumber: { type: String, default: '' },
  color: { type: String, default: '' },
  mileage: { type: Number },
  image: { type: String, default: '' },
  imageFileId: { type: String, default: '' },
  // Full photo set (image/imageFileId above is just photos[0], kept as its
  // own field since most of the app only ever needs one thumbnail). Cars
  // created before this existed just have an empty array here — Car Detail
  // falls back to the single `image` for those.
  photos: [{ url: String, fileId: String }],
  isAvailable: { type: Boolean, default: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  // Admin-curated pick for the homepage stacked carousel. When no car has
  // this set, the carousel falls back to auto-picking top-rated cars
  // instead — see GET /cars/featured.
  featured: { type: Boolean, default: false },
  availabilityRequest: {
    status: { type: String, enum: ['none', 'pending', 'declined'], default: 'none' },
    // Which direction this request is asking for — a consignor needs admin
    // sign-off both to hide a listed car AND to bring it back, so both
    // directions flow through this same request object.
    type: { type: String, enum: ['unavailable', 'available'], default: 'unavailable' },
    reason: { type: String, default: '' },
    requestedAt: { type: Date },
    adminNotes: { type: String, default: '' },
  },
  // Date ranges where this car can't be booked at all, regardless of
  // whether anything is actually booked (e.g. scheduled maintenance, the
  // owner keeping it for personal use) — a hard block same as a confirmed
  // booking's dates, just not derived from an actual reservation.
  // Admin-added ranges apply immediately (status: 'approved'). A
  // consignor blocking their own car needs admin sign-off first — the
  // range sits as 'pending' and has zero effect on booking/availability
  // until approved, same reasoning as availabilityRequest above: a
  // consignor shouldn't be able to unilaterally take booking capacity
  // offline without review.
  blockedDates: [{
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['approved', 'pending', 'declined'], default: 'approved' },
    requestedBy: { type: String, enum: ['admin', 'consignor'], default: 'admin' },
    adminNotes: { type: String, default: '' },
  }],
}, { timestamps: true });

export default mongoose.model('Car', carSchema);