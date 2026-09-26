// One-off: turn the identity documents already in ImageKit into private
// files, so a plain link stops serving them.
//
//     node scripts/makeDocumentsPrivate.mjs          (lists what it would do)
//     node scripts/makeDocumentsPrivate.mjs --apply  (does it)
//
// Run this ONLY once every screen is confirmed to show documents through
// the signed route, because the moment a file turns private a plain link to
// it stops working. Uploads have been private since the change that added
// this file; these are the ones from before it.
//
// Car photographs and avatars are never touched: they are meant to be seen.
import mongoose from 'mongoose';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Only the fields holding somebody's identity. The FileId twin of each is
// what ImageKit needs in order to change one.
const DOCUMENT_FIELDS = [
  ['validIdImage', 'validIdImageFileId'],
  ['validIdImageBack', 'validIdImageBackFileId'],
  ['licenseImage', 'licenseImageFileId'],
  ['licenseImageBack', 'licenseImageBackFileId'],
  ['pendingValidIdImage', 'pendingValidIdImageFileId'],
  ['pendingValidIdImageBack', 'pendingValidIdImageBackFileId'],
  ['pendingLicenseImage', 'pendingLicenseImageFileId'],
  ['pendingLicenseImageBack', 'pendingLicenseImageBackFileId'],
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, family: 4 });
  const users = await User.find({}).lean();

  const jobs = [];
  for (const user of users) {
    const who = user.name || user.email;
    for (const [urlField, idField] of DOCUMENT_FIELDS) {
      if (!user[urlField]) continue;
      if (user[idField]) {
        jobs.push({ who, field: urlField, fileId: user[idField] });
      } else {
        // Without a stored fileId there is nothing to change through the
        // API. Named rather than skipped quietly: somebody has to know it
        // is still sitting in the open.
        console.warn(`! ${who}: ${urlField} has no stored fileId, cannot be privatised automatically`);
      }
    }
  }

  console.log(`${jobs.length} document(s) across ${users.length} client(s)`);
  if (!apply) {
    for (const j of jobs) console.log(`  would privatise ${j.field} for ${j.who}`);
    console.log('\nDry run. Re-run with --apply once the screens are confirmed.');
    await mongoose.disconnect();
    return;
  }

  let done = 0;
  for (const j of jobs) {
    try {
      await imagekit.updateFileDetails(j.fileId, { isPrivateFile: true });
      done += 1;
      console.log(`  privatised ${j.field} for ${j.who}`);
    } catch (err) {
      // Left public rather than half-changed, and named so it can be
      // finished by hand.
      console.error(`  FAILED ${j.field} for ${j.who}: ${err.message}`);
    }
  }
  console.log(`\n${done} of ${jobs.length} done.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
