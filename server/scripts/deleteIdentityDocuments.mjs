// One-off: destroy every identity document this system ever collected.
//
//     node scripts/deleteIdentityDocuments.mjs          (lists what it would do)
//     node scripts/deleteIdentityDocuments.mjs --apply  (deletes them)
//
// Removing the upload forms stopped new photographs arriving. It did
// nothing about the ones already here: ID fronts and backs, licence photos,
// OR and CR scans, sitting in ImageKit exactly as before. A feature nobody
// can reach is not a file nobody can read, and the files were the whole
// reason for the change.
//
// Two things happen per document, in this order: the file is deleted from
// ImageKit, then the field is removed from the record. That way round
// because a field pointing at a file that no longer exists is untidy, while
// a file nobody has a link to is still a file somebody can find.
//
// It reads the collections directly rather than through the models. The
// Mongoose schemas no longer declare these fields at all — that was the
// point — so a model query would hand back documents with the very things
// this script exists to find already stripped out of them.
import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';

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

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Each pair is the field holding the link and the field holding the id
// ImageKit needs to delete it. Listed exhaustively on purpose: a document
// missed here is a document that stays.
const USER_DOCS = [
  ['validIdImage', 'validIdImageFileId'],
  ['validIdImageBack', 'validIdImageBackFileId'],
  ['licenseImage', 'licenseImageFileId'],
  ['licenseImageBack', 'licenseImageBackFileId'],
  ['pendingValidIdImage', 'pendingValidIdImageFileId'],
  ['pendingValidIdImageBack', 'pendingValidIdImageBackFileId'],
  ['pendingLicenseImage', 'pendingLicenseImageFileId'],
  ['pendingLicenseImageBack', 'pendingLicenseImageBackFileId'],
];

const CONSIGNMENT_DOCS = [
  ['orImage', 'orImageFileId'],
  ['crImage', 'crImageFileId'],
];

// Fields that carry no file but describe one, and have no meaning once the
// photographs are gone.
const USER_LEFTOVERS = [
  'idVerified', 'pendingValidIdType', 'pendingValidIdExpiry',
  'pendingLicenseNumber', 'pendingLicenseExpiry', 'pendingIdSubmittedAt',
];

async function destroy(fileId) {
  if (!fileId) return 'no file id recorded';
  try {
    await imagekit.deleteFile(fileId);
    return 'deleted';
  } catch (err) {
    // Already gone is a success, not a failure: the point is that it is not
    // there any more, and something having removed it earlier still counts.
    if (/does not exist|not found/i.test(err?.message || '')) return 'already gone';
    return `FAILED — ${err?.message || 'unknown error'}`;
  }
}

async function sweep(collection, pairs, leftovers, label) {
  const docs = await collection.find({}).toArray();
  let found = 0;
  let removed = 0;
  const failures = [];

  for (const doc of docs) {
    const present = pairs.filter(([urlField]) => doc[urlField]);
    const hasLeftovers = leftovers.some((f) => doc[f] !== undefined);
    if (!present.length && !hasLeftovers) continue;

    const who = doc.name || doc.plateNumber || String(doc._id);
    for (const [urlField, idField] of present) {
      found += 1;
      if (!apply) {
        console.log(`  - ${who}: ${urlField} (${doc[idField] || 'no file id'})`);
        continue;
      }
      const outcome = await destroy(doc[idField]);
      console.log(`  > ${who}: ${urlField} — ${outcome}`);
      if (outcome.startsWith('FAILED')) failures.push(`${who}/${urlField}`);
      else removed += 1;
    }

    if (apply) {
      const unset = {};
      for (const [urlField, idField] of pairs) { unset[urlField] = ''; unset[idField] = ''; }
      for (const f of leftovers) unset[f] = '';
      await collection.updateOne({ _id: doc._id }, { $unset: unset });
    }
  }

  console.log(`${label}: ${found} document${found === 1 ? '' : 's'} on file`
    + (apply ? `, ${removed} removed, ${failures.length} failed.` : '. Re-run with --apply to delete.'));
  return failures;
}

(async () => {
  await ensureSrvLookupWorks(uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log(apply ? 'Deleting identity documents.\n' : 'Dry run — nothing will be deleted.\n');

  const failures = [
    ...await sweep(db.collection('users'), USER_DOCS, USER_LEFTOVERS, 'Clients and consignors'),
    ...await sweep(db.collection('consignments'), CONSIGNMENT_DOCS, [], 'Vehicle papers'),
  ];

  if (failures.length) {
    console.log(`\n${failures.length} file(s) could not be deleted from ImageKit and are STILL THERE:`);
    for (const f of failures) console.log(`  ${f}`);
    console.log('Delete these by hand in the ImageKit dashboard, then run this again to confirm.');
  } else if (apply) {
    console.log('\nNothing left. Every identity document has been deleted.');
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
