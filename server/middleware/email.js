// One spelling of an address, everywhere.
//
// Email addresses are not case sensitive in practice — nobody has one
// mailbox at TEST@gmail.com and a different one at test@gmail.com. The code
// treated them as different strings, so "is this address taken?" compared
// two spellings of the same mailbox and said no. Two accounts, one inbox,
// and a password reset that could land on either.
//
// Fixed at the edge rather than at each of the dozen places that look an
// address up. Normalising in one handler and forgetting in another is how
// this kind of bug comes back, and a lookup that misses is silent: it reads
// as "available" rather than as an error.
//
// Deliberately NOT touching anything else. Gmail ignores dots and treats
// anything after a + as the same mailbox, so a.b+test@gmail.com and
// ab@gmail.com reach one person — but that is a Gmail convention, not an
// email one, and other providers treat those as genuinely different
// addresses. Collapsing them would lock people out of accounts they
// deliberately keep apart.
const clean = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export function normaliseEmail(req, res, next) {
  if (req.body && req.body.email !== undefined) req.body.email = clean(req.body.email);
  if (req.query && req.query.email !== undefined) req.query.email = clean(req.query.email);
  next();
}

// Matches an address however it was spelled when it was stored. New rows are
// lowercased on the way in, but anything saved before this existed may not
// be, and a duplicate check that misses those would let a second account
// through for a mailbox that already has one.
export function sameEmail(address) {
  const escaped = String(address || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { email: new RegExp(`^${escaped}$`, 'i') };
}
