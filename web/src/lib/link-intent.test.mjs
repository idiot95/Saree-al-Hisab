// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { sealLinkIntent, openLinkIntent } = await import(`${process.env.LIB}/link-intent.js`);

const T = 1_000_000, MIN10 = 10 * 60 * 1000;
const tok = sealLinkIntent('user-1', 'secret', T);
assert.equal(openLinkIntent(tok, 'secret', T), 'user-1');
assert.equal(openLinkIntent(tok, 'secret', T + MIN10), 'user-1');
assert.equal(openLinkIntent(tok, 'secret', T + MIN10 + 1), null);
assert.equal(openLinkIntent(tok, 'other', T), null);

const [p, m] = tok.split('.');
const forged = Buffer.from('user-2.' + (T + MIN10)).toString('base64url');
assert.equal(openLinkIntent(`${forged}.${m}`, 'secret', T), null);
assert.equal(openLinkIntent(`${p}.${m.slice(0, -2)}AA`, 'secret', T), null);
for (const bad of ['', 'x', 'a.b.c', '.', 'a.b', '!!.!!', `${p}.`, `${p}.short`]) {
  assert.equal(openLinkIntent(bad, 'secret', T), null);
}
