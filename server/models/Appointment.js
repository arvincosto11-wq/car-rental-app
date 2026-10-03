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

  //   booked     waiting to happen
  //   passed     seen, approved, vehicle entered — the owner is a consignor now
  //   failed     seen, not approved. They may book again once it is sorted.
  //   missed     nobody came
  //   cancelled  called off, by either side, before the day
  status: { type: String, enum: ['booked', 'passed', 'failed', 'missed', 'cancelled'], default: 'booked' },

  // What admin wrote when they closed it. Shown to the owner, because
  // "declined" with no reason is the kind of answer that produces a phone
  // call rather than a fixed problem.
  outcomeNote: { type: String, default: '' },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

// One vehicle per slot. A unique index rather than a check-then-write,
// because two people pressing Book at the same moment is exactly the case a
// check-then-write misses — and the partial filter means a cancelled or
// missed appointment frees its slot again.
appointmentSchema.index(
  { at: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' } },
);

// A consignor's own list, newest first.
appointmentSchema.index({ owner: 1, at: -1 });

export default mongoose.model('Appointment', appointmentSchema);
