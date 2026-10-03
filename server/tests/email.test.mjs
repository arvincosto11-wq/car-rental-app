import { suite, group, check } from './harness.mjs';
import { normaliseEmail, sameEmail } from '../middleware/email.js';

// The middleware signature, exercised the way Express calls it.
const through = (body = {}, query = {}) => {
  const req = { body, query };
  let called = false;
  normaliseEmail(req, {}, () => { called = true; });
  return { req, called };
};

const matches = (pattern, address) => pattern.email.test(address);

export default function run() {
  suite('Email addresses');

  group('one spelling, whatever was typed');
  check('capitals come down', through({ email: 'TEST@Gmail.COM' }).req.body.email, 'test@gmail.com');
  check('stray spaces go', through({ email: '  test@gmail.com  ' }).req.body.email, 'test@gmail.com');
  check('already clean is untouched', through({ email: 'test@gmail.com' }).req.body.email, 'test@gmail.com');
  check('query strings too', through({}, { email: 'TEST@GMAIL.COM' }).req.query.email, 'test@gmail.com');
  check('it always continues', through({ email: 'a@b.com' }).called, true);

  group('what it must not touch');
  // Gmail treats these as one mailbox; other providers do not. Collapsing
  // them would lock somebody out of an account they keep deliberately apart
  // — and this project's own test accounts are built on +aliases.
  check('a plus alias survives', through({ email: 'me+test1@gmail.com' }).req.body.email, 'me+test1@gmail.com');
  check('dots survive', through({ email: 'first.last@gmail.com' }).req.body.email, 'first.last@gmail.com');
  check('no email, no crash', through({ name: 'x' }).req.body.name, 'x');
  check('a missing body is fine', (() => { const r = { }; normaliseEmail(r, {}, () => {}); return true; })(), true);
  // A non-string from a tampered request must pass through rather than
  // become the string "null", which would then look like a real address.
  check('a non-string is left alone', through({ email: null }).req.body.email, null);

  group('finding an address stored before any of this');
  check('exact', matches(sameEmail('test@gmail.com'), 'test@gmail.com'), true);
  check('stored in capitals', matches(sameEmail('test@gmail.com'), 'TEST@GMAIL.COM'), true);
  check('stored mixed', matches(sameEmail('test@gmail.com'), 'TeSt@GmAiL.cOm'), true);
  check('a different address does not match', matches(sameEmail('test@gmail.com'), 'other@gmail.com'), false);
  // The whole string, not part of it: otherwise "a@b.com" would match
  // "aa@b.com" and refuse a registration that should be allowed.
  check('anchored at the start', matches(sameEmail('test@gmail.com'), 'xtest@gmail.com'), false);
  check('anchored at the end', matches(sameEmail('test@gmail.com'), 'test@gmail.com.ph'), false);
  // An address is allowed to contain regex characters. Unescaped, the dot
  // alone would match any character and "a.b@x.com" would collide with
  // "axb@x.com".
  check('a dot is a dot', matches(sameEmail('a.b@x.com'), 'axb@x.com'), false);
  check('and still matches itself', matches(sameEmail('a.b@x.com'), 'A.B@X.COM'), true);
  check('a plus is a plus', matches(sameEmail('me+a@x.com'), 'me+a@x.com'), true);
  check('and is not a repeat', matches(sameEmail('me+a@x.com'), 'meeea@x.com'), false);
}
