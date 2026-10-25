// One-off: make an approved application's plate match the vehicle it made.
//
//     node scripts/repairConsignmentPlates.mjs          (lists what it would do)
//     node scripts/repairConsignmentPlates.mjs --apply  (writes it)
//
// Approving an application creates the live vehicle from it, and the two
// have carried the same plate ever since — except where the plate was
// corrected on the vehicle afterwards, which left the application still
// reading the old one.
//
// That happened once, before any plate guard existed: a Nissan Almera was
// applied for on ABC 1237, which the Toyota Avanza already held. The
// duplicate was spotted and the VEHICLE was renumbered to ABC 1337. The
// application was not, so Manage Consignments still shows that Almera under
// the Avanza's plate.
//
// Manage Consignments is the register of consigned vehicles, not an archive
// of what was once typed — a vehicle that is live but missing from that
// list is a vehicle nobody is managing, which is why the record exists at
// all. So the register should say what the vehicle says.
//
// Only ever copies FROM the vehicle TO the application, only where the two
// disagree, and only where the application is approved and linked. It never
// touches a vehicle, never touches a pending application, and refuses to
// write a plate that would read as a clash on the register.
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Consignment from '../models/Consignment.js';
import Car from '../models/Car.js';
import { plateKey } from '../utils/plates.js';

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

async function run() {
  await ensureSrvLookupWorks(uri);
  await mongoose.connect(uri);
  console.log(apply ? 'Writing.' : 'Dry run — nothing will be written.');
  console.log();

  const consignments = await Consignment.find({ status: 'approved', linkedCar: { $ne: null } })
    .populate('linkedCar', 'brand model plateNumber archived');

  let changed = 0;
  let skipped = 0;

  for (const c of consignments) {
    const car = c.linkedCar;
    if (!car) continue;

    const onRecord = c.plateNumber || '';
    const onVehicle = car.plateNumber || '';

    if (!onVehicle) {
      console.log(`SKIP  ${c.brand} ${c.model}: the vehicle has no plate to copy.`);
      skipped += 1;
      continue;
    }
    if (plateKey(onRecord) === plateKey(onVehicle)) continue;

    // Would the corrected record read as a clash on the register itself?
    // Two applications showing one plate is the same confusion in a
    // different list, so it is reported rather than written.
    const alsoOnRegister = consignments.find((other) => (
      String(other._id) !== String(c._id)
      && plateKey(other.plateNumber) === plateKey(onVehicle)
    ));
    if (alsoOnRegister) {
      console.log(`SKIP  ${c.brand} ${c.model}: ${onVehicle} is already on the ${alsoOnRegister.brand} ${alsoOnRegister.model} application.`);
      skipped += 1;
      continue;
    }

    console.log(`${apply ? 'FIX  ' : 'WOULD'} ${c.brand} ${c.model}: record says ${onRecord || '(blank)'}, vehicle says ${onVehicle}`);
    changed += 1;

    if (apply) {
      c.plateNumber = onVehicle;
      await c.save();
    }
  }

  console.log();
  console.log(`${changed} application${changed === 1 ? '' : 's'} ${apply ? 'corrected' : 'would be corrected'}, ${skipped} skipped, ${consignments.length} checked.`);
  if (!apply && changed) console.log('Run again with --apply to write it.');

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
