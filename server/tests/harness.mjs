// A deliberately small test harness.
//
// These tests exist to protect the rules this system charges people money
// by: what a booking costs, which discount wins, what comes back on a
// refund, when a vehicle is free, and what "7:00 AM" means. None of that
// needs a database, a browser or a test framework — it needs a function, an
// input and the answer it should give.
//
// Keeping it to one file of helpers means there is nothing to learn before
// adding a check, and nothing to install before running one.

const results = { passed: 0, failed: [] };

export const suite = (name) => {
  console.log(`\n${name}`);
  console.log('─'.repeat(Math.max(name.length, 20)));
};

export const group = (name) => console.log(`\n  ${name}`);

// Compared as text, which gives readable output for the things these rules
// actually deal in — numbers, booleans, dates and short strings — without
// needing a matcher for each.
export const check = (label, got, want) => {
  const ok = String(got) === String(want);
  if (ok) {
    results.passed += 1;
    console.log(`    ok    ${label}`);
  } else {
    results.failed.push({ label, got: String(got), want: String(want) });
    console.log(`    FAIL  ${label}`);
    console.log(`            got:    ${got}`);
    console.log(`            wanted: ${want}`);
  }
};

// For a rule whose whole point is that it refuses something. Passing the
// message as well keeps the check honest: a rule that rejects for the wrong
// reason is still broken.
export const checkRefused = (label, message, mustMention) => {
  const refused = !!message;
  const mentions = refused && (!mustMention || message.toLowerCase().includes(mustMention.toLowerCase()));
  check(label, refused && mentions, true);
  if (refused && !mentions) console.log(`            message was: ${message}`);
};

export const report = () => {
  const { passed, failed } = results;
  console.log('\n' + '═'.repeat(60));
  if (!failed.length) {
    console.log(`  ${passed} checks passed.`);
    console.log('═'.repeat(60) + '\n');
    return 0;
  }
  console.log(`  ${passed} passed, ${failed.length} FAILED:\n`);
  for (const f of failed) console.log(`    • ${f.label}\n        got ${f.got}, wanted ${f.want}`);
  console.log('═'.repeat(60) + '\n');
  return 1;
};
