// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { flowCookieOptions, LINK_COOKIE, INVITE_COOKIE, RESET_COOKIE, LINK_MAX_AGE, INVITE_MAX_AGE, RESET_MAX_AGE } =
  await import(`${process.env.LIB}/flow-cookies.js`);
const { looksLikeLinkToken, newLinkToken } = await import(`${process.env.LIB}/link-token.js`);

assert.equal(LINK_COOKIE, 'ql.link');
assert.equal(INVITE_COOKIE, 'ql.invite');
assert.equal(LINK_MAX_AGE, 600);
assert.equal(INVITE_MAX_AGE, 900);
assert.equal(RESET_COOKIE, 'ql.reset');
assert.equal(RESET_MAX_AGE, 600);

// httpOnly, Lax, path /, no domain; Secure only over https.
assert.deepEqual(flowCookieOptions(600, 'https'),
  { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
assert.equal(flowCookieOptions(600, 'https,http').secure, true);
assert.equal(flowCookieOptions(600, 'http').secure, false);
assert.equal(flowCookieOptions(600, null).secure, false);
assert.equal('domain' in flowCookieOptions(900, 'https'), false);

assert.equal(looksLikeLinkToken(newLinkToken().token), true);
assert.equal(looksLikeLinkToken('short'), false);
assert.equal(looksLikeLinkToken('a'.repeat(42) + '/'), false);
assert.equal(looksLikeLinkToken('../' + 'a'.repeat(40)), false);
assert.equal(looksLikeLinkToken(undefined), false);

console.log('  flow-cookies: ok');
