// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { passwordSignInOpen } = await import(`${process.env.LIB}/password-window.js`);

assert.equal(passwordSignInOpen(new Date('2027-01-01'), '2027-01-02'), true);
assert.equal(passwordSignInOpen(new Date('2027-01-03'), '2027-01-02'), false);
const d = new Date('2027-01-01');
assert.equal(passwordSignInOpen(d, 'nonsense'), true);
assert.equal(passwordSignInOpen(d, undefined), true);
assert.equal(passwordSignInOpen(d, ''), true);
