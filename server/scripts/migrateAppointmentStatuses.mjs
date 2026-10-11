// One-off: bring appointments written before the accept/approve split onto
// the statuses the system now understands.
//
//     node scripts/migrateAppointmentStatuses.mjs          (lists what it would do)
//     node scripts/migrateAppointmentStatuses.mjs --apply  (writes the changes)
//
// Accepting an appointment and approving a vehicle used to be one decision,
// so an appointment was simply 'booked' and then 'passed' or 'failed'. They
// are two decisions now — see models/Appointment.js — and the old words are
// not in the enum any more.
//
// That is not cosmetic for a visit still ahead of us. Every screen looks for
// the live statuses, and 'booked' is not one of them, so such an appointment
// vanishes: it is missing from Coming up, cannot be accepted, cancelled or
// marked, is not counted by the sidebar badge, and the owner's own dashboard
// says they have no appointment at all — which lets them book a second one.
// Somebody is still expecting to be met.
//
//   booked  -> accepted   the visit stands and admin can act on it again
//   passed  -> completed  the vehicle was taken on
//   failed  -> rejected   the vehicle was turned away
//
// 'passed' is the awkward one. It meant "approved, listing to follow", and
// a listing may never have followed — the gap that caused the split. It is
// mapped to 'completed' because that is the nearest true thing about a
// closed visit, and because the alternative, inventing a vehicle to match
// it, would be worse. Any such appointment is named in the output so it can
// be checked by hand against Manage Consignments.
//
// It reads the collection directly rather than through the model: Mongoose
// would refuse to save a document whose stored status is not in the enum,
// which is every document this script exists to find.
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Some home routers refuse SRV lookups, which is how a mongodb+srv:// address
// is found. Asked once; if the machine's own resolver will not answer, a
// public one is used for the rest of the run.
async function ensureSrvLookupWorks(address) {
  const host = (address.match(/@([^/?,]+)/) || [])[1];
  if (!address.startsWith('mongodb+srv://') || !host) return;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch {
    console.log("This machine's DNS will not answer SRV lookups; using 8.8.8.8 for this run.");
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
}

const apply = process.argv.includes('--apply');

const uri = process.env.MONGO_URI_LIVE || process.env.MONGO_URI;
if (!uri) {
  console.error('Set MONGO_URI_LIVE to the production connection string first.');
  process.exit(1);
}
if (!process.env.MONGO_URI_LIVE) {
  console.log('MONGO_URI_LIVE is not set — falling back to MONGO_URI, which may be your local database.');
}

const MAPPING = {
  booked: 'accepted',
  passed: 'completed',
  failed: 'rejected',
};

const when = (at) => (at
  ? new Date(at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
  : 'no date');

(async () => {
  await ensureSrvLookupWorks(uri);
  await mongoose.connect(uri);
  const appointments = mongoose.connection.db.collection('appointments');

  console.log(apply ? 'Updating old appointment statuses.\n' : 'Dry run — nothing will be written.\n');

  const old = await appointments.find({ status: { $in: Object.keys(MAPPING) } }).toArray();
  if (!old.length) {
    console.log('Nothing to do: every appointment already uses the current statuses.');
    await mongoose.disconnect();
    return;
  }

  const now = Date.now();
  const checkByHand = [];
  let changed = 0;

  for (const row of old) {
    const to = MAPPING[row.status];
    const vehicle = [row.vehicle?.brand, row.vehicle?.model].filter(Boolean).join(' ') || 'vehicle not noted';
    const ahead = row.at && new Date(row.at).getTime() > now;
    const note = ahead ? '  <- still ahead of us' : '';

    if (!apply) {
      console.log(`  - ${when(row.at)}  ${vehicle}  ${row.status} -> ${to}${note}`);
    } else {
      // closedAt only where the visit is actually finished with. An accepted
      // one is still open, and stamping it would read as closed.
      const update = { $set: { status: to } };
      if (to !== 'accepted' && !row.closedAt) update.$set.closedAt = row.updatedAt || row.at || new Date();
      await appointments.updateOne({ _id: row._id }, update);
      changed += 1;
      console.log(`  > ${when(row.at)}  ${vehicle}  ${row.status} -> ${to}${note}`);
    }

    if (row.status === 'passed') checkByHand.push(`${vehicle} (${when(row.at)})`);
  }

  console.log(`\n${old.length} appointment${old.length === 1 ? '' : 's'} on the old statuses`
    + (apply ? `, ${changed} updated.` : '. Re-run with --apply to write the changes.'));

  if (checkByHand.length) {
    console.log('\nWorth checking by hand in Manage Consignments — these were marked approved under the');
    console.log('old flow, which did not create the listing, so a vehicle may never have been added:');
    for (const c of checkByHand) console.log(`  ${c}`);
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
