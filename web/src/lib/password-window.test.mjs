// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { passwordSignInOpen } = await import(`${process.env.LIB}/password-window.js`);

assert.equal(passwordSignInOpen(new Date('2027-01-01'), '2027-01-02'), true);
assert.equal(passwordSignInOpen(new Date('2027-01-03'), '2027-01-02'), false);
const d = new Date('2027-01-01');
assert.equal(passwordSignInOpen(d, 'nonsense'), true);
assert.equal(passwordSignInOpen(d, undefined), true);
assert.equal(passwordSignInOpen(d, ''), true);

// The configured window: closed after the date, and a bad value warns once.
const { passwordSignInOpenNow } = await import(`${process.env.LIB}/password-window.js`);
const said = [];
assert.equal(passwordSignInOpenNow('2000-01-01', d, (m) => said.push(m)), false);
assert.equal(passwordSignInOpenNow('2099-01-01', d, (m) => said.push(m)), true);
assert.equal(passwordSignInOpenNow(undefined, d, (m) => said.push(m)), true);
assert.equal(said.length, 0);
assert.equal(passwordSignInOpenNow('nonsense', d, (m) => said.push(m)), true);
assert.equal(passwordSignInOpenNow('nonsense', d, (m) => said.push(m)), true);
assert.equal(said.length, 1);
assert.ok(!said[0].includes('nonsense'), 'the warning does not echo the value');
