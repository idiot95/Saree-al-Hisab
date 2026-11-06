// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { decideGoogleSignIn } = await import(`${process.env.LIB}/google-signin.js`);

const claims = { sub: 's1', email: 'x@y.com', emailVerified: true };
const none = {
  identityUserId: null, sessionUserId: null, linkIntentUserId: null,
  sessionUserHasGoogle: false, emailOwnerId: null, invite: null,
};
const d = (c = {}, f = {}) => decideGoogleSignIn({ ...claims, ...c }, { ...none, ...f });

assert.deepEqual(d({}, { identityUserId: 'u1' }), { kind: 'signin', userId: 'u1' });
assert.deepEqual(d({ emailVerified: false }, { identityUserId: 'u1' }), { kind: 'refuse', code: 'unverified' });
assert.deepEqual(d({}, { linkIntentUserId: 'u2', sessionUserId: 'u2' }), { kind: 'link', userId: 'u2' });
assert.deepEqual(
  d({}, { linkIntentUserId: 'u2', sessionUserId: 'u2', sessionUserHasGoogle: true }),
  { kind: 'refuse', code: 'already-linked' });
assert.deepEqual(
  d({}, { identityUserId: 'u9', linkIntentUserId: 'u2', sessionUserId: 'u2' }),
  { kind: 'refuse', code: 'already-linked' });
// Link intent for someone other than the session: not linked, email rule applies.
assert.deepEqual(
  d({}, { linkIntentUserId: 'u2', sessionUserId: 'u3', emailOwnerId: 'u4' }),
  { kind: 'refuse', code: 'exists-link-first' });
assert.deepEqual(d({}, { linkIntentUserId: 'u2', sessionUserId: 'u3' }), { kind: 'create' });
assert.deepEqual(
  d({ email: 'Ammar@Gmail.com' }, { emailOwnerId: 'u4' }),
  { kind: 'refuse', code: 'exists-link-first' });
assert.deepEqual(d({}, {}), { kind: 'create' });
assert.deepEqual(d({ email: 'x@Y.com' }, { invite: { email: 'X@y.com' } }), { kind: 'create' });
assert.deepEqual(
  d({ email: 'x@Y.com' }, { invite: { email: 'X@y.com' }, identityUserId: 'u5' }),
  { kind: 'join-existing', userId: 'u5' });
assert.deepEqual(
  d({ email: 'b@x.com' }, { invite: { email: 'a@x.com' } }),
  { kind: 'refuse', code: 'invite-mismatch' });
// Fix round 1.
assert.deepEqual(
  d({ email: 'x@Y.com' }, { invite: { email: 'X@y.com' }, emailOwnerId: 'u4' }),
  { kind: 'refuse', code: 'exists-link-first' });
assert.deepEqual(
  d({}, { identityUserId: 'u2', linkIntentUserId: 'u2', sessionUserId: 'u2' }),
  { kind: 'link', userId: 'u2' });
assert.deepEqual(
  d({ email: ' x@y.com' }, { invite: { email: 'x@y.com' } }),
  { kind: 'refuse', code: 'invite-mismatch' });
