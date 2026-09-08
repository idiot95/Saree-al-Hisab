import assert from 'node:assert/strict';
const { nth } = await import(`${process.env.LIB}/ordinal.js`);

assert.equal(nth(1), '1st');
assert.equal(nth(2), '2nd');
assert.equal(nth(3), '3rd');
assert.equal(nth(4), '4th');
assert.equal(nth(5), '5th');
// the teens are the whole reason this is not "last digit wins"
assert.equal(nth(11), '11th');
assert.equal(nth(12), '12th');
assert.equal(nth(13), '13th');
assert.equal(nth(21), '21st');
assert.equal(nth(22), '22nd');
assert.equal(nth(23), '23rd');
// the far end of a month, which is what a statement day actually is
assert.equal(nth(28), '28th');
assert.equal(nth(30), '30th');
assert.equal(nth(31), '31st');

console.log('ordinal: every day of the month reads right');
