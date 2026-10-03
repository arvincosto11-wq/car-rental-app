import mongoose from 'mongoose';

// The one place configuration lives.
//
// Until now there was none, so every rule the business might want to change
// — refund tiers, late fees, booking hours, how far we deliver — was a
// constant in a file only a developer could reach. "Configurable" meant
// "we would have to ship a new version".
//
// Deliberately a single document rather than a key/value table. There is
// one business with one set of rules, and a table of loose keys would mean
// every reader guessing at types and coping with a missing row. One
// document with a schema means Mongoose validates it and the defaults below
// ARE the system's behaviour before anybody touches anything.
//
// It starts with delivery because that is what needed it first. Other
// sections get added here as each rule stops being a constant.
const settingsSchema = new mongoose.Schema({
  // Enforces the singleton: a unique index on a field with exactly one
  // allowed value means a second document cannot be created, by us or by
  // anything else.
  key: { type: String, default: 'global', unique: true, enum: ['global'] },

  // Where the vehicles actually are. Every delivery distance is measured
  // from this point, so moving the pin reprices every future quote — and
  // deliberately not past bookings, which carry the fee they were quoted.
  base: {
    label: { type: String, default: 'Salugan, Camalig, Albay' },
    lat: { type: Number, default: 13.1769 },
    lng: { type: Number, default: 123.6553 },
  },

  delivery: {
    // Off means handover happens at base only. The booking form then stops
    // asking for a place at all rather than offering one that always costs
    // nothing.
    enabled: { type: Boolean, default: true },
    // Kilometres nobody is charged for. Crossing our own barangay should
    // not carry a fee.
    freeKm: { type: Number, default: 3 },
    ratePerKm: { type: Number, default: 25 },
    // Past this we say no, before they pay rather than after. This is what
    // answers "somebody booked from outside Albay".
    maxKm: { type: Number, default: 60 },
    // Straight-line distance understates a real drive. See utils/delivery.js.
    roadFactor: { type: Number, default: 1.3 },
  },

  // When somebody can bring a vehicle in to be inspected. Slots are worked
  // out from these rather than stored — see utils/appointments.js.
  appointments: {
    enabled: { type: Boolean, default: true },
    // Days of the week you are open for inspections, 0 = Sunday.
    days: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    startHour: { type: Number, default: 9 },
    endHour: { type: Number, default: 16 },
    // How long one inspection takes, which is also how far apart the slots
    // sit. One vehicle per slot.
    slotMinutes: { type: Number, default: 60 },
    // Nobody can book this afternoon: somebody has to be free to meet them.
    leadHours: { type: Number, default: 24 },
    horizonDays: { type: Number, default: 30 },
  },
}, { timestamps: true });

// Always returns a document, creating the defaults on first use, so no
// caller has to handle "settings don't exist yet" — which would otherwise
// be every caller, forever, for a row that is missing exactly once.
settingsSchema.statics.current = async function current() {
  const existing = await this.findOne({ key: 'global' });
  if (existing) return existing;
  return this.create({ key: 'global' });
};

export default mongoose.model('Settings', settingsSchema);
