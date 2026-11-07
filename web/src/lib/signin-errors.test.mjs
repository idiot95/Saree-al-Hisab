// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { signInErrorSentence, signInErrorPath } = await import(`${process.env.LIB}/signin-errors.js`);

assert.equal(signInErrorSentence('exists-link-first'),
  'You already have books here. Sign in with your password once, then link Google from Household.');
assert.equal(signInErrorSentence('already-linked'), 'That Google account is already linked to someone.');
assert.equal(signInErrorSentence('invite-mismatch'),
  'This invitation was sent to a different address. Sign in with the Google account it was sent to.');
assert.equal(signInErrorSentence('unverified'), "Google hasn't verified that address yet.");
assert.equal(signInErrorSentence('cutoff'), 'Password sign-in has ended. Continue with Google.');
// Nothing else gets words: unknown codes, prototype keys, arrays, absence.
for (const x of ['nope', 'toString', '__proto__', 'constructor', '', undefined, ['cutoff'], null]) {
  assert.equal(signInErrorSentence(x), null, String(x));
}
assert.equal(signInErrorPath('cutoff'), '/signin?e=cutoff');
