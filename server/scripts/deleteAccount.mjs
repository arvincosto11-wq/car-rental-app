// Remove one account, by email.
//
//     node scripts/deleteAccount.mjs someone@example.com          (looks)
//     node scripts/deleteAccount.mjs someone@example.com --apply  (deletes)
//
// There is no way to delete an account from the admin screens — they can
// block somebody, which stops them booking, but the row stays and so does
// the address. That is usually right: a real customer's history is worth
// keeping even after they stop renting. It is wrong for the accounts that
// get made while testing, which sit on an address somebody wants back.
//
// It refuses rather than cascades. An account with bookings or vehicles is
// referenced by rows this script cannot see the consequences of — a booking
// whose user no longer exists is worse than a leftover account, because it
// breaks every screen that reads the name off it. Those get blocked
// instead, which is what the admin panel is for.
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Car from '../models/Car.js';
import Consignment from '../models/Consignment.js';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';

dotenv.config();

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

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const wanted = args.find((a) => !a.startsWith('--'));

if (!wanted) {
  console.error('Say which account: node scripts/deleteAccount.mjs someone@example.com');
  process.exit(1);
}

const uri = process.env.MONGO_URI_LIVE || process.env.MONGO_URI;
if (!uri) {
  console.error('Set MONGO_URI_LIVE to the production connection string first.');
  process.exit(1);
}
if (!process.env.MONGO_URI_LIVE) {
  console.log('MONGO_URI_LIVE is not set — falling back to MONGO_URI, which may be your local database.');
}

(async () => {
  await ensureSrvLookupWorks(uri);
  await mongoose.connect(uri);

  // Case-insensitive, for the same reason the sign-up checks are: the
  // address somebody types is the address they mean, however they spell it.
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ email: new RegExp(`^${escaped}$`, 'i') });

  if (!users.length) {
    console.log(`No account on ${wanted}. Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  for (const user of users) {
    const [bookings, cars, consignments, appointments] = await Promise.all([
      Booking.countDocuments({ user: user._id }),
      Car.countDocuments({ owner: user._id }),
      Consignment.countDocuments({ owner: user._id }),
      Appointment.countDocuments({ owner: user._id }),
    ]);

    console.log(`\n${user.name} <${user.email}> — ${user.role}, joined ${user.createdAt.toDateString()}`);
    console.log(`  bookings ${bookings} · vehicles ${cars} · applications ${consignments} · appointments ${appointments}`);

    if (user.role === 'admin') {
      console.log('  REFUSED: this is an admin account. Deleting it could lock you out.');
      continue;
    }
    if (bookings || cars || consignments) {
      console.log('  REFUSED: other records point at this account, and deleting it would leave them');
      console.log('  naming somebody who does not exist. Block it in Manage Clients instead.');
      continue;
    }

    if (!apply) {
      console.log('  Would delete this account. Re-run with --apply to do it.');
      continue;
    }

    // Appointments and notifications belong to nobody else, so they go too.
    const [appts, notes] = await Promise.all([
      Appointment.deleteMany({ owner: user._id }),
      Notification.deleteMany({ user: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    console.log(`  Deleted, along with ${appts.deletedCount} appointment(s) and ${notes.deletedCount} notification(s).`);
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
