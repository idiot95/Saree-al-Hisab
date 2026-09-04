// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { format, fromKeys, keysDisplay } = await import(`${process.env.LIB}/money.js`);

// Indian grouping is the whole reason this file exists.
assert.equal(format(21560000), '₹2,15,600');
assert.equal(format(100000), '₹1,000');
assert.equal(format(1000000), '₹10,000');
assert.equal(format(10000000), '₹1,00,000');
assert.equal(format(234000), '₹2,340');
assert.equal(format(-234000), '−₹2,340');
assert.equal(format(12000000, 'INR', { sign: true }), '+₹1,20,000');
assert.equal(format(50000, 'USD'), '$500');

// The keypad builds paise from digits, never parses a float.
assert.equal(fromKeys('2340'), 234000);
assert.equal(fromKeys(''), 0);
assert.equal(fromKeys('0001'), 100);
assert.equal(keysDisplay('215600'), '2,15,600');
assert.equal(keysDisplay('0'), '0');
assert.equal(keysDisplay(''), '0');
assert.equal(keysDisplay('007'), '7');

console.log('money: 15 assertions passed');

// Paise, and the guards around the keypad.
const { pushKey, popKey } = await import(`${process.env.LIB}/money.js`);
assert.equal(fromKeys('2340.5'), 234050);
assert.equal(fromKeys('2340.55'), 234055);
assert.equal(fromKeys('.5'), 50);
assert.equal(keysDisplay('2340.'), '2,340.');
assert.equal(keysDisplay('215600.5'), '2,15,600.5');
assert.equal(pushKey('', '5'), '5');
assert.equal(pushKey('0', '5'), '5');            // no leading zero
assert.equal(pushKey('2340', '.'), '2340.');
assert.equal(pushKey('2340.', '.'), '2340.');    // only one point
assert.equal(pushKey('2340.55', '9'), '2340.55');// only two paise digits
assert.equal(pushKey('999999999', '9'), '999999999'); // nine digits is the ceiling
assert.equal(popKey('2340'), '234');
console.log('money: 12 more assertions passed');
