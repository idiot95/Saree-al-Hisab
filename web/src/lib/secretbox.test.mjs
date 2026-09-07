// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { seal, open, hint } = await import(`${process.env.LIB}/secretbox.js`);

const SECRET = 'a-sufficiently-long-auth-secret-value';
const PLAIN = 'AQ.Ab8RN6-not-a-real-key-0000000000000';

const box = seal(PLAIN, SECRET);
assert.match(box, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'versioned and structured');
assert.ok(!box.includes(PLAIN), 'the secret does not appear in what is stored');
assert.equal(open(box, SECRET), PLAIN, 'it comes back out');

assert.notEqual(seal(PLAIN, SECRET), seal(PLAIN, SECRET), 'a fresh nonce every time');
assert.equal(open(seal(PLAIN, SECRET), SECRET), PLAIN, 'and both still open');

// The wrong secret must not open it, and must not throw either.
assert.equal(open(box, 'a-completely-different-auth-secret-x'), null);

// Tampering is caught by the tag rather than silently returning rubbish.
const [v, n, b, t] = box.split('.');
const flipped = Buffer.from(b, 'base64url');
flipped[0] ^= 1;
assert.equal(open([v, n, flipped.toString('base64url'), t].join('.'), SECRET), null,
  'a changed ciphertext does not open');
assert.equal(open(`${v}.${n}.${b}.${'A'.repeat(t.length)}`, SECRET), null,
  'a changed tag does not open');
assert.equal(open('nonsense', SECRET), null);
assert.equal(open('v2.a.b.c', SECRET), null, 'an unknown version is refused, not guessed at');

assert.throws(() => seal(PLAIN, 'short'), /AUTH_SECRET/, 'a weak secret is refused outright');

assert.equal(hint('AQ.Ab8RN6IYe_-dKbs3iXU7'), 'AQ.A…iXU7', 'first four and last four only');
assert.equal(hint('abc'), '••••', 'a short value is not half-revealed');

console.log('  ok   sealed secrets');
