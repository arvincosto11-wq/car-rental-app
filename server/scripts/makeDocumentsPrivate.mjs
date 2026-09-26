// One-off: move the identity documents already in ImageKit onto private
// files, so a plain link stops serving them.
//
//     node scripts/makeDocumentsPrivate.mjs          (lists what it would do)
//     node scripts/makeDocumentsPrivate.mjs --apply  (does it)
//     node scripts/makeDocumentsPrivate.mjs --delete-originals
//
// Why it copies rather than flips a switch: ImageKit decides whether a file
// is private when it is uploaded, and nowhere else. Its update-details API
// accepts isPrivateFile without complaint and then ignores it — the call
// returns success and the file stays public, which is worse than an error,
// because it reports a job done that was not. The only way to make an
// existing file private is to put the same bytes back as a new private file
// and point the record at that.
//
// So this runs in two passes. The first uploads the private copy, repoints
// the client's record and checks the new link serves — nothing is lost, and
// the originals are still there to fall back on. The second deletes those
// originals, and that one cannot be undone.
//
// Car photographs and avatars are never touched: they are meant to be seen.
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const apply = process.argv.includes('--apply');
const deleteOriginals = process.argv.includes('--delete-originals');

// Where the first pass records what it replaced, so the second knows what to
// delete and there is a written trail if anything needs putting back.
const JOURNAL = path.join(process.cwd(), 'scripts', 'privatised-originals.json');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// The live database, only ever passed in for this one job. MONGO_URI on a
// developer's machine points at their own local MongoDB, and running this
// against that would report nothing to do while the real documents sit
// untouched — so the live address gets its own name, and is deleted again
// once the job is done.
const uri = process.env.MONGO_URI_LIVE || process.env.MONGO_URI;
if (!uri) {
  console.error('No database address. Set MONGO_URI_LIVE to the live one.');
  process.exit(1);
}

// Only the fields holding somebody's identity.
const DOCUMENT_FIELDS = [
  'validIdImage', 'validIdImageBack',
  'licenseImage', 'licenseImageBack',
  'pendingValidIdImage', 'pendingValidIdImageBack',
  'pendingLicenseImage', 'pendingLicenseImageBack',
];

const readJournal = () => (fs.existsSync(JOURNAL) ? JSON.parse(fs.readFileSync(JOURNAL, 'utf8')) : []);

async function movePass() {
  const users = await User.find({}).lean();

  const jobs = [];
  for (const user of users) {
    const who = user.name || user.email;
    for (const field of DOCUMENT_FIELDS) {
      const url = user[field];
      if (!url) continue;
      const fileId = user[`${field}FileId`];
      if (!fileId) {
        // Without a stored fileId there is no way to ask ImageKit what this
        // file is, or to remove it afterwards. Named rather than skipped
        // quietly: somebody has to know it is still sitting in the open.
        console.warn(`! ${who}: ${field} has no stored fileId, left alone`);
        continue;
      }
      const details = await imagekit.getFileDetails(fileId).catch(() => null);
      if (!details) {
        console.warn(`! ${who}: ${field} is not in ImageKit any more, left alone`);
        continue;
      }
      if (details.isPrivateFile) continue;
      jobs.push({ userId: String(user._id), who, field, fileId, url, details });
    }
  }

  console.log(`${jobs.length} public document(s) to move`);
  if (!jobs.length) return;

  if (!apply) {
    for (const j of jobs) console.log(`  would copy ${j.field} for ${j.who} (${j.details.name})`);
    console.log('\nDry run. Re-run with --apply.');
    return;
  }

  const journal = readJournal();
  for (const j of jobs) {
    try {
      // The bytes come from the link the record already holds — the file is
      // public, which is the whole problem, so fetching it needs nothing.
      const res = await fetch(j.url);
      if (!res.ok) throw new Error(`could not read the original (${res.status})`);
      const bytes = Buffer.from(await res.arrayBuffer());

      const folder = path.posix.dirname(j.details.filePath || '/');
      const uploaded = await imagekit.upload({
        file: bytes,
        fileName: j.details.name,
        isPrivateFile: true,
        ...(folder && folder !== '/' ? { folder } : {}),
        useUniqueFileName: true,
      });

      // Checked before the record is moved across, so a copy that cannot be
      // read never replaces one that can.
      const plain = await fetch(uploaded.url).then((r) => r.status).catch(() => 0);
      const signed = await fetch(imagekit.url({ src: uploaded.url, signed: true, expireSeconds: 300 }))
        .then((r) => r.status).catch(() => 0);
      if (plain !== 403 || signed !== 200) {
        throw new Error(`copy behaved wrongly (plain ${plain}, signed ${signed})`);
      }

      await User.updateOne(
        { _id: j.userId },
        { $set: { [j.field]: uploaded.url, [`${j.field}FileId`]: uploaded.fileId } },
      );

      journal.push({
        who: j.who,
        userId: j.userId,
        field: j.field,
        oldFileId: j.fileId,
        oldUrl: j.url,
        oldName: j.details.name,
        newFileId: uploaded.fileId,
        newUrl: uploaded.url,
        movedAt: new Date().toISOString(),
      });
      fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 2));
      console.log(`  moved ${j.field} for ${j.who}`);
    } catch (err) {
      // Left as it was rather than half-moved: the record still points at
      // the original, which still works.
      console.error(`  FAILED ${j.field} for ${j.who}: ${err.message}`);
    }
  }
  console.log(`\nJournal written to ${JOURNAL}`);
}

async function deletePass() {
  const journal = readJournal();
  const pending = journal.filter((e) => !e.originalDeletedAt);
  console.log(`${pending.length} original(s) to delete`);
  if (!pending.length) return;

  if (!apply) {
    for (const e of pending) console.log(`  would delete ${e.oldName} (${e.field} for ${e.who})`);
    console.log('\nDry run. Re-run with --apply --delete-originals.');
    return;
  }

  for (const entry of pending) {
    // Refuse to delete anything a record still points at. The move pass
    // should have replaced it; if it did not, this is the last place that
    // would notice before the file is gone for good.
    const stillUsed = await User.findOne({ [`${entry.field}FileId`]: entry.oldFileId }).lean();
    if (stillUsed) {
      console.error(`  SKIPPED ${entry.oldName}: a record still points at it`);
      continue;
    }
    try {
      await imagekit.deleteFile(entry.oldFileId);
      entry.originalDeletedAt = new Date().toISOString();
      console.log(`  deleted ${entry.oldName} (${entry.field} for ${entry.who})`);
    } catch (err) {
      console.error(`  FAILED ${entry.oldName}: ${err.message}`);
    }
  }
  fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 2));
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 });
  const local = /localhost|127\.0\.0\.1/.test(mongoose.connection.host);
  console.log(`Connected to "${mongoose.connection.name}" on ${local ? 'this machine' : 'a hosted server'}.`);
  if (local && !process.env.MONGO_URI_LIVE) {
    console.warn('This is your local database, not the live one. Set MONGO_URI_LIVE first.');
  }

  if (deleteOriginals) await deletePass();
  else await movePass();

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
