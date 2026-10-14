// Catches a component used in JSX that nothing imports or defines.
//
// Vite builds such a file happily — the name is only a reference, resolved
// when the component renders — and ESLint's no-undef does not look at JSX
// tag names (that is react/jsx-no-undef, from a plugin we do not have). So
// `<SkeletonListCard />` with the wrong import shipped, threw on load, and
// rendered Manage Bookings as an empty page.
//
// Run with: npm run check:jsx
import fs from 'fs';
import path from 'path';

const root = 'src';
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) files.push(full);
  }
})(root);

// Everything a file can legitimately call a component.
const namesIn = (src) => {
  const known = new Set(['Fragment']);
  const add = (n) => n && known.add(n.trim().split(/\s+as\s+/).pop());

  for (const m of src.matchAll(/import\s+([^'"]+?)\s+from\s*['"][^'"]+['"]/g)) {
    const clause = m[1];
    const named = clause.match(/\{([^}]*)\}/);
    if (named) named[1].split(',').forEach(add);
    const rest = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ');
    for (const part of rest.split(/\s+/)) {
      if (part && part !== '*' && part !== 'as') add(part);
    }
  }
  for (const m of src.matchAll(/^\s*(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_]\w*)/gm)) add(m[1]);
  // Destructured from props or hooks: `const { Icon } = x`
  for (const m of src.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=/g)) m[1].split(',').forEach((p) => add(p.split(':').pop()));
  return known;
};

let bad = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const known = namesIn(src);
  const used = new Set();
  // Opening tags only, capitalised, ignoring member tags like <motion.div>.
  for (const m of src.matchAll(/<([A-Z]\w*)(?=[\s/>])/g)) used.add(m[1]);
  for (const name of used) {
    if (!known.has(name)) {
      console.error(`${file}: <${name}> is used but never imported or defined`);
      bad += 1;
    }
  }
}

if (bad) {
  console.error(`\n${bad} undefined component${bad === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`No undefined components in ${files.length} files.`);
