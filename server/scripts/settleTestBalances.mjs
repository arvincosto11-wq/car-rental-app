// One-off: record the money outstanding on finished TEST bookings as
// collected, the way the counter would have.
//
//     node scripts/settleTestBalances.mjs            (lists what it would do)
//     node scripts/settleTestBalances.mjs --apply    (writes it)
//     node scripts/settleTestBalances.mjs --undo     (puts it back)
//
// Why this exists. Every test booking was made by paying the 20% deposit
// through GCash and then marked completed by hand — nobody ever pressed
// "Mark Balance Received", because no money ever changed hands. So 61
// finished trips still owe 80% of their price, and My Bookings keeps a
// finished trip in the live section for exactly that reason: money
// outstanding is something the client has to act on. The result is a demo
// account whose "Also going on" list is fifteen trips long and whose
// owner apparently never paid for anything.
//
// Nothing is wrong with the page. The data is wrong, and this fixes the
// data: it does what the admin's collect-balance and late-fee routes do,
// to the bookings that were never really paid for.
//
// What it does NOT do, deliberately:
//   - it sends no notifications. The routes tell the client "we've
//     recorded your balance as paid", which is true when somebody hands
//     over cash and a lie when a script backfills test data. Sixty-two of
//     them would also bury every real notification on those accounts.
//   - it never touches a damage charge. Those are settled in person with
//     the vehicle there, and no script should close one.
//   - it only ever looks at completed bookings. Nothing live is altered.
//
// Reversible: --apply writes a snapshot beside this file first, and --undo
// reads it back. Run --undo before changing anything else about these
// bookings, or the snapshot will put back a figure that is no longer right.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from '../models/Booking.js';

dotenv.config();

// Some home routers refuse SRV lookups, which is how a mongodb+srv://
// address is found. Asked once; if the machine's own resolver will not
// answer, a public one is used for the rest of the run.
async function ensureSrvLookupWorks(address) {
  const host = (address.match(/@([^/?,]+)/) || [])[1];
  if (!address.startsWith('mongodb+srv://') || !host) return;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch {
    console.log('This machine\'s DNS will not answer SRV lookups; using 8.8.8.8 for this run.');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
}

const apply = process.argv.includes('--apply');
const undo = process.argv.includes('--undo');
const SNAPSHOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'settleTestBalances.snapshot.json');

const uri = process.env.MONGO_URI_LIVE || process.env.MONGO_URI;
if (!uri) {
  console.error('Set MONGO_URI_LIVE to the production connection string first.');
  process.exit(1);
}
if (!process.env.MONGO_URI_LIVE) {
  console.log('MONGO_URI_LIVE is not set — falling back to MONGO_URI, which may be your local database.');
}

await ensureSrvLookupWorks(uri);
await mongoose.connect(uri);

const peso = (n) => `P${Math.round(n || 0).toLocaleString('en-US')}`;

if (undo) {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error('No snapshot to undo from. It is written by --apply.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const saved = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  console.log(`Putting back ${saved.rows.length} booking(s) as they were on ${saved.takenAt}.\n`);
  for (const row of saved.rows) {
    const set = { amountPaid: row.amountPaid };
    const unset = {};
    if (row.clearLateFeeCollectedAt) unset['lateFee.collectedAt'] = '';
    await Booking.updateOne(
      { _id: row.id },
      Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
    );
    console.log(`  <  ...${String(row.id).slice(-6)}  amountPaid back to ${peso(row.amountPaid)}`);
  }
  console.log('\nDone. The snapshot is left in place; delete it when you are happy.');
  await mongoose.disconnect();
  process.exit(0);
}

// Only finished trips. A booking still running is owed money legitimately
// — that is what "to pay at pickup" means — and settling it would be a
// lie about a trip that has not happened.
const bookings = await Booking.find({ status: 'completed' })
  .select('user car totalPrice amountPaid lateFee fuel condition')
  .populate('user', 'email')
  .lean();

const rows = [];
for (const b of bookings) {
  const balance = Math.max(0, (b.totalPrice || 0) - (b.amountPaid || 0));
  const lateFee = (b.lateFee?.amount || 0) > 0 && !b.lateFee?.collectedAt ? b.lateFee.amount : 0;
  const fuel = (b.fuel?.charge || 0) > 0 && !b.fuel?.collectedAt ? b.fuel.charge : 0;
  if (balance + lateFee + fuel === 0) continue;
  rows.push({ b, balance, lateFee, fuel });
}

console.log(`${rows.length} finished booking(s) still owing something.\n`);

let money = 0;
for (const { b, balance, lateFee, fuel } of rows) {
  const parts = [
    balance > 0 && `balance ${peso(balance)}`,
    lateFee > 0 && `late fee ${peso(lateFee)}`,
    fuel > 0 && `fuel ${peso(fuel)}`,
  ].filter(Boolean).join(' + ');
  money += balance + lateFee + fuel;
  console.log(`  ${apply ? '>' : '-'}  ...${String(b._id).slice(-6)}  ${b.user?.email || 'unknown'}  ${parts}`);
}
console.log(`\n${peso(money)} across ${rows.length} booking(s).`);

if (!apply) {
  console.log('\nNothing written. Re-run with --apply to record these as collected.');
  await mongoose.disconnect();
  process.exit(0);
}

fs.writeFileSync(SNAPSHOT, JSON.stringify({
  takenAt: new Date().toISOString(),
  rows: rows.map(({ b, lateFee }) => ({
    id: String(b._id),
    amountPaid: b.amountPaid,
    clearLateFeeCollectedAt: lateFee > 0,
  })),
}, null, 2));
console.log(`\nSnapshot written to ${SNAPSHOT}`);

const now = new Date();
for (const { b, balance, lateFee, fuel } of rows) {
  const set = {};
  // Same as collect-balance: amountPaid reaching totalPrice IS the
  // "settled" signal everywhere else reads, so no extra field is needed.
  if (balance > 0) set.amountPaid = b.totalPrice;
  if (lateFee > 0) set['lateFee.collectedAt'] = now;
  if (fuel > 0) set['fuel.collectedAt'] = now;
  await Booking.updateOne({ _id: b._id }, { $set: set });
}

console.log(`Recorded ${rows.length} booking(s) as collected. Run with --undo to put them back.`);
await mongoose.disconnect();
