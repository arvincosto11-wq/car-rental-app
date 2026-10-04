import mongoose from 'mongoose';

// Somebody bringing a vehicle in to be looked at.
//
// This is the first half of becoming a consignor. Nothing about the vehicle
// is entered online any more — no details, no photographs of papers — so the
// only thing an application can be before the visit is an appointment with a
// rough note about what is coming.
//
// The record outlives its outcome on purpose. A missed appointment and a
// vehicle that failed its check are both things worth being able to look
// back at, and both are things somebody will ask about.
const appointmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // The slot itself, stored as a real instant. Philippine wall-clock time is
  // reconstructed from it wherever it is shown — see utils/appointments.js.
  at: { type: Date, required: true },

  // Enough to know what is turning up and roughly how long it will take.
  // Deliberately not the full vehicle record: that is typed at the office,
  // with the vehicle in front of whoever is typing.
  vehicle: {
    brand: { type: String, default: '' },
    model: { type: String, default: '' },
    year: { type: Number },
    note: { type: String, default: '' },
  },

  // Two decisions live here, and they are not the same decision. The first
  // is about the appointment: will we see this person at this time. The
  // second is about the vehicle, and only happens once it is in front of us.
  //
  //   requested  they picked a slot; nobody has answered yet
  //   accepted   we confirmed it; they are coming
  //   cancelled  called off, by either side, before the day
  //   missed     accepted, the slot passed, nobody came
  //   rejected   seen, and the vehicle was not taken on
  //   completed  seen, taken on, and the listing created
  //
  // There is no "approved" state, on purpose. Approving used to be its own
  // button, which meant an owner could be told their listing was being set
  // up while no listing existed — which is exactly what happened. Creating
  // the listing IS the approval, so this reaches 'completed' only when a
  // vehicle actually exists. See routes/cars.js.
  status: {
    type: String,
    enum: ['requested', 'accepted', 'cancelled', 'missed', 'rejected', 'completed'],
    default: 'requested',
  },

  // What admin wrote when they closed it. Shown to the owner, because
  // "declined" with no reason is the kind of answer that produces a phone
  // call rather than a fixed problem.
  outcomeNote: { type: String, default: '' },
  closedAt: { type: Date, default: null },

  // What the visit produced, filled in at the counter with the papers in
  // hand. Kept on the appointment rather than only on the vehicle, because
  // a visit that ended in a refusal has no vehicle to keep it on.
  inspection: {
    // Each thing somebody confirmed they had actually looked at.
    checked: { type: [String], default: [] },
    // Read off the CR while it is in front of them, then carried onto the
    // vehicle — so the booking checks that depend on it work from day one
    // rather than from whenever somebody remembers to fill it in.
    registrationExpiry: { type: Date, default: null },
    at: { type: Date, default: null },
  },
}, { timestamps: true });

// One vehicle per slot. A unique index rather than a check-then-write,
// because two people pressing Book at the same moment is exactly the case a
// check-then-write misses — and the partial filter means a cancelled or
// missed appointment frees its slot again. Both live states hold a slot: a
// request is a claim on that time until somebody answers it.
appointmentSchema.index(
  { at: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['requested', 'accepted'] } } },
);

// A consignor's own list, newest first.
appointmentSchema.index({ owner: 1, at: -1 });

export default mongoose.model('Appointment', appointmentSchema);
