// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { gatherSignInFacts } = await import(`${process.env.LIB}/google-facts.js`);
const { sealLinkIntent } = await import(`${process.env.LIB}/link-intent.js`);

const NOW = 1_800_000_000_000, SECRET = 's3cret';
const claims = { sub: 'g-1', email: 'Ammar@Example.com', emailVerified: true };
const seen = { emails: [], googleAsked: [] };
const base = (over = {}) => ({
  identityUser: async (sub) => (sub === 'g-1' ? 'u-known' : null),
  userIdByEmail: async (e) => { seen.emails.push(e); return e === 'ammar@example.com' ? 'u-owner' : null; },
  hasGoogle: async (id) => { seen.googleAsked.push(id); return id === 'u-linked'; },
  sessionUserId: async () => null,
  linkIntentToken: undefined, secret: SECRET, nowMs: NOW, invite: null,
  ...over,
});

// Signed out, no intent: the lookups, lower-cased email, no hasGoogle call.
let f = await gatherSignInFacts(claims, base());
assert.deepEqual(f, {
  identityUserId: 'u-known', sessionUserId: null, linkIntentUserId: null,
  sessionUserHasGoogle: false, emailOwnerId: 'u-owner', invite: null,
});
assert.deepEqual(seen.emails, ['ammar@example.com']);
assert.deepEqual(seen.googleAsked, []);

// A valid intent opens to its user; the session's Google status is asked.
const token = sealLinkIntent('u-linked', SECRET, NOW - 1000);
f = await gatherSignInFacts(claims, base({ linkIntentToken: token, sessionUserId: async () => 'u-linked' }));
assert.equal(f.linkIntentUserId, 'u-linked');
assert.equal(f.sessionUserId, 'u-linked');
assert.equal(f.sessionUserHasGoogle, true);

// No secret, empty secret, wrong secret, expired: the intent is nobody.
for (const over of [{ secret: undefined }, { secret: '' }, { secret: 'other' }, { nowMs: NOW + 11 * 60 * 1000 }]) {
  f = await gatherSignInFacts(claims, base({ linkIntentToken: token, ...over }));
  assert.equal(f.linkIntentUserId, null, JSON.stringify(over));
}

// The invite is passed through untouched.
f = await gatherSignInFacts(claims, base({ invite: { email: 'x@y.z' } }));
assert.deepEqual(f.invite, { email: 'x@y.z' });
