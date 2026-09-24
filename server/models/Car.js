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
  // A vehicle that is not fit to rent, from now until somebody says it is
  // again. Open-ended on purpose: a blocked date range needs an end, and
  // nobody knows on the day of a breakdown how long the workshop will take.
  // Until it is cleared the car is unavailable for every future date, which
  // is what stops the next client booking a car sitting on a ramp.
  offRoad: {
    since: { type: Date, default: null },
    note: { type: String, default: '' },
  },
  // CR (Certificate of Registration) renewal date — optional, since older
  // cars added before this field existed won't have one on file yet. See
  // GET /admin/expiring-documents.
  registrationExpiry: { type: Date },
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
  // Hours needed between one client returning this vehicle and the next
  // collecting it. Blank means the standard two (see turnaroundHoursFor in
  // utils/phTime.js) — only set on vehicles that genuinely need longer,
  // like a van.
  turnaroundHours: { type: Number, default: null },
  // Lets admin double-check a listing before it's visible to customers.
  // Defaults to 'published' so every car created before this field existed
  // behaves exactly as it did (see the $ne: 'draft' checks in routes/cars.js
  // rather than status: 'published' — a stored-but-missing field won't
  // match an equality query, only a $ne one).
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  avgRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  // Admin-curated pick for the homepage stacked carousel. When no car has
  // this set, the carousel falls back to auto-picking top-rated cars
  // instead — see GET /cars/featured.
  featured: { type: Boolean, default: false },
  // Last known position reported by this car's physical GPS tracker.
  // updatedAt stays null until a real device actually reports in — the
  // GPS Tracking dashboard fills the gap with a deterministic placeholder
  // position until then, see GET /cars/gps-fleet.
  gps: {
    lat: { type: Number },
    lng: { type: Number },
    speed: { type: Number },
    ignitionOn: { type: Boolean },
    updatedAt: { type: Date, default: null },
  },
  // Links this car to a physical GPS tracker's device ID on the AIKA
  // platform (the "ID Number" shown in their app/web dashboard, e.g.
  // "9176761220") — set by admin once a tracker is assigned to this
  // vehicle. Empty means no real tracker yet, so GET /cars/gps-fleet
  // falls back to the mock placeholder position instead.
  gpsDeviceId: { type: String, default: '' },
  // A single limited-time offer on this vehicle, set by admin only (never
  // by a consignor, even on their own car). Empty startDate means no promo.
  // The discount comes off the booking TOTAL, and only when the whole
  // rental sits inside the window — see the promo block in routes/bookings.js.
  // Nothing here is retroactive: a booking stores the discount it was made
  // with, so editing or clearing this can't rewrite an existing receipt.
  promo: {
    label: { type: String, default: '' },
    type: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    value: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    createdAt: { type: Date },
  },
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
    // A block covers whole days unless admin gave it times — "in for aircon
    // service 8:00 AM to 12:00 PM, back on the road in the afternoon".
    // False on every range saved before this existed, which is what they
    // always meant.
    hasTime: { type: Boolean, default: false },
    // Whether endDate is the last day OFF the road, or the day the vehicle
    // is back on it. The form has always asked for "the last day" but the
    // stored date was read as the day it returned, so that day stayed
    // bookable while the vehicle was still in the workshop.
    //
    // Only set on ranges saved from now on. Older ones keep the meaning
    // they were saved with rather than silently growing a day — two live
    // ranges would have landed on a day a confirmed booking already uses.
    endsInclusive: { type: Boolean, default: false },
    // reasonCode decides what a client is told when this block cancels
    // their booking; note is private and never leaves the admin/owner side.
    // `reason` is the old free-text field, kept so ranges saved before this
    // existed still render (see blockLabelFor in utils/blockReasons.js).
    reasonCode: { type: String, default: '' },
    note: { type: String, default: '' },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['approved', 'pending', 'declined'], default: 'approved' },
    requestedBy: { type: String, enum: ['admin', 'consignor'], default: 'admin' },
    adminNotes: { type: String, default: '' },
  }],
}, { timestamps: true });

export default mongoose.model('Car', carSchema);