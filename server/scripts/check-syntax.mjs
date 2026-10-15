// Does every server file still parse?
//
// Written after an import was inserted INTO a multi-line import statement,
// which left routes/adminStats.js invalid. Nothing caught it: the tests
// import pure helpers, not routes, and the client builds separately. The
// push went green, Render's build failed, and the old build kept serving —
// so two days' worth of server work was live-but-not-really for an hour
// while everything looked fine.
//
// A syntax error is the cheapest thing in the world to find. Run before
// the tests, so it is found here rather than in a deploy log nobody opens.

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  if (entry === 'node_modules' || entry.startsWith('.')) return [];
  const full = join(dir, entry);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.m?js$/.test(entry) ? [full] : [];
});

const files = walk(root);
const broken = [];

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    broken.push({ file: file.replace(root, ''), why: String(err.stderr).split('\n').slice(0, 4).join('\n') });
  }
}

if (broken.length) {
  console.error(`\n${broken.length} file${broken.length === 1 ? '' : 's'} will not parse:\n`);
  for (const b of broken) console.error(`  ${b.file}\n${b.why}\n`);
  process.exit(1);
}

console.log(`${files.length} server files parse.`);
