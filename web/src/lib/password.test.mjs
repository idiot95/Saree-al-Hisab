// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { hashPassword, verifyPassword, needsRehash, passwordProblem } =
  await import(`${process.env.LIB}/password.js`);
const { newLinkToken, hashLinkToken } = await import(`${process.env.LIB}/link-token.js`);

const PW = 'chikoo mango falsa';

// ── the hash ───────────────────────────────────────────────────────────────
const h = await hashPassword(PW);
assert.match(h, /^scrypt\$17\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/,
  'the stored form names its own parameters');
assert.ok(!h.includes(PW), 'the password itself is nowhere in what we store');
assert.ok(await verifyPassword(PW, h), 'the right password verifies');
assert.ok(!(await verifyPassword('chikoo mango falsb', h)), 'one letter wrong does not');
assert.ok(!(await verifyPassword('', h)), 'an empty password does not');

const h2 = await hashPassword(PW);
assert.notEqual(h, h2, 'the same password twice gives different hashes — the salt is per-user');
assert.ok(await verifyPassword(PW, h2), 'and both still verify');

// Unicode is normalised, so a password typed on two keyboards is one password.
const composed = 'café monsoon rain', decomposed = 'café monsoon rain';
assert.ok(await verifyPassword(decomposed, await hashPassword(composed)),
  'the same letters in a different encoding are the same password');

// A stored hash carries its own cost, so raising it later cannot lock anyone out.
const old = h.replace('scrypt$17$8$1$', 'scrypt$15$8$1$');
assert.ok(!(await verifyPassword(PW, old)), 'changing the recorded cost invalidates the hash');
assert.ok(needsRehash('scrypt$15$8$1$a$b'), 'a weaker hash is marked for upgrading');
assert.ok(!needsRehash(h), 'a current one is not');
assert.ok(needsRehash('bcrypt$x'), 'something that is not ours is marked too');
assert.ok(!(await verifyPassword(PW, 'nonsense')), 'a corrupt stored value verifies nothing');

// ── what we refuse to let people choose ────────────────────────────────────
const bad = (pw, email) => assert.ok(passwordProblem(pw, email), `should refuse: ${pw}`);
const good = (pw, email) => assert.equal(passwordProblem(pw, email), null, `should allow: ${pw}`);

bad('short');
bad('123456789');
bad('password123');
bad('1password');
bad('letmein2024');
bad('qwertyuiop');
bad('aaaaaaaaaaaa');
bad('1234567890');
bad('abcdefghij');
bad('          ');
bad('x'.repeat(129));
bad('ammar12345', 'ammar@example.com');
bad('myammarpw1', 'ammar@example.com');

good('chikoo mango falsa');
good('correct horse battery staple');
good('the 4 o clock train');
// No composition rules: a long ordinary phrase passes without a symbol in it.
good('we keep the books together');
// A short address must not start rejecting half the dictionary.
good('chikoo mango falsa', 'jo@example.com');

// ── link tokens ────────────────────────────────────────────────────────────
const { token, hash } = newLinkToken();
assert.equal(hashLinkToken(token), hash, 'the hash is reproducible from the token');
assert.ok(token.length >= 43, '256 bits of randomness, base64url');
assert.ok(!hash.includes(token), 'the token cannot be read back out of its hash');
assert.notEqual(newLinkToken().token, newLinkToken().token, 'every token is new');

console.log('  ok   password hashing, strength rules and link tokens');
