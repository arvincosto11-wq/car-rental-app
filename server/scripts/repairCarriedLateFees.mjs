// One-off: put back the carried late-fee fields that marking a vehicle
// returned used to erase.
//
//     node scripts/repairCarriedLateFees.mjs          (lists what it would do)
//     node scripts/repairCarriedLateFees.mjs --apply  (writes it)
//
// What went wrong: the return handler worked the fee out with lateFeeFor,
// which READS lateFee.carriedDays and carriedAmount, and then stored a fresh
// { days, amount, collectedAt } over the top. The totals it wrote were
// right; the two fields explaining them were gone. So a booking could say
// "3 days late, P3,248" under a note reading "one day's rental rate per day
// of delay" — and 3 x the daily rate is not P3,248, because one of those
// days had already been settled at half rate when the client extended.
//
// Nothing was overcharged and nothing is owed. This only restores the
// record's account of itself.
//
// How it reconstructs the split, given only the totals and the rate:
//
//     amount = fresh*rate + carried*rate/2      days = fresh + carried
//     => fresh = 2*amount/rate - days           carried = days - fresh
//
// It then rebuilds the amount from that split and refuses to write unless it
// lands on the stored figure exactly. That check is what makes this safe: if
// the vehicle's daily rate has been edited since the return, the arithmetic
// will not reconcile and the booking is reported and skipped rather than
// guessed at.
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import { EXTENSION_LATE_DISCOUNT } from '../utils/overdueReturns.js';

dotenv.config();

// Some home routers refuse SRV lookups, which is how a mongodb+srv:// address
// is found. Asked once; if the machine's own resolver will not answer, a
// public one is used for the rest of the run. Same fallback as
// makeDocumentsPrivate.mjs.
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

// Only completed bookings carrying a late fee that claims no carried days.
// A booking that already has them was written after the fix and needs
// nothing.
const bookings = await Booking.find({
  status: 'completed',
  'lateFee.amount': { $gt: 0 },
  $or: [{ 'lateFee.carriedDays': { $exists: false } }, { 'lateFee.carriedDays': 0 }],
}).select('car lateFee endDate returnedAt').lean();

console.log(`${bookings.length} completed booking(s) with a late fee and no carried days.\n`);

const rates = new Map();
async function rateFor(carId) {
  const key = String(carId);
  if (!rates.has(key)) {
    const car = await Car.findById(carId).select('pricePerDay').lean();
    rates.set(key, Number(car?.pricePerDay) || 0);
  }
  return rates.get(key);
}

let toFix = 0;
let consistent = 0;
let unreconciled = 0;

for (const b of bookings) {
  const rate = await rateFor(b.car);
  const { days, amount } = b.lateFee;
  const id = String(b._id).slice(-6);

  if (!rate) {
    console.log(`  ?  ...${id}  no daily rate on the vehicle — skipped`);
    unreconciled += 1;
    continue;
  }

  // Nothing was carried: the total is exactly the days at the full rate.
  if (days * rate === amount) {
    consistent += 1;
    continue;
  }

  // Tried rather than solved. The algebra inverts cleanly on paper, but
  // carriedAmount was stored through Math.round — booking #15's half-day is
  // Math.round(649.5) = 650 — so dividing back lands on 2.0008 rather than 2
  // and a whole-number check throws out the very records this is for. The
  // day count is tiny, so every split is simply tried and the one that
  // rebuilds the stored figure exactly wins.
  const splits = [];
  for (let carried = 1; carried <= days; carried += 1) {
    const fresh = days - carried;
    const carriedAmount = Math.round(carried * rate * EXTENSION_LATE_DISCOUNT);
    if (fresh * rate + carriedAmount === amount) splits.push({ fresh, carried, carriedAmount });
  }

  if (splits.length !== 1) {
    console.log(
      `  !  ...${id}  ${days} days / P${amount} at P${rate}/day `
      + `${splits.length === 0 ? 'does not reconcile' : `has ${splits.length} possible splits`}`
      + ' — skipped, needs a human'
    );
    unreconciled += 1;
    continue;
  }

  const { fresh, carried, carriedAmount } = splits[0];

  toFix += 1;
  console.log(
    `  ${apply ? '>' : '-'}  ...${id}  ${days} days / P${amount}  =  `
    + `${fresh} at P${rate} + ${carried} carried at half (P${carriedAmount})`
  );

  if (apply) {
    await Booking.updateOne(
      { _id: b._id },
      { $set: { 'lateFee.carriedDays': carried, 'lateFee.carriedAmount': carriedAmount } }
    );
  }
}

console.log(
  `\n${consistent} already consistent, ${toFix} ${apply ? 'repaired' : 'to repair'}`
  + `, ${unreconciled} needing a look.`
);
if (!apply && toFix > 0) console.log('Re-run with --apply to write it.');

await mongoose.disconnect();
