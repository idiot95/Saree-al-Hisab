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
assert.equal(format(123456700, 'AED'), 'AED\u00a01,234,567');   // thousands, code as symbol
assert.equal(format(123456700, 'PKR'), 'Rs\u00a012,34,567');    // lakhs beyond India too
assert.equal(keysDisplay('1234567', 'GBP'), '1,234,567');

// A bare format() means whatever the installed resolver says — the server
// installs one per request; nothing installed means rupees.
const { setCurrencyResolver, symbolOf, isCurrency } = await import(`${process.env.LIB}/money.js`);
setCurrencyResolver(() => 'USD');
assert.equal(format(50000), '$500');
assert.equal(symbolOf(), '$');
setCurrencyResolver(() => 'INR');
assert.equal(format(50000), '₹500');
assert.equal(isCurrency('KWD'), true);
assert.equal(isCurrency('SGD'), true);
assert.equal(isCurrency('XXX'), false);

// The keypad builds paise from digits, never parses a float.
assert.equal(fromKeys('2340'), 234000);
assert.equal(fromKeys(''), 0);
assert.equal(fromKeys('0001'), 100);
assert.equal(keysDisplay('215600'), '2,15,600');
assert.equal(keysDisplay('0'), '0');
assert.equal(keysDisplay(''), '0');
assert.equal(keysDisplay('007'), '7');

console.log('money: 25 assertions passed');

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

// Minor units are the currency's own: fils are thousandths, yen are whole.
const { toKeys, typed, settleKeys, digitsOf, unitOf, CURRENCIES } = await import(`${process.env.LIB}/money.js`);
assert.equal(digitsOf('KWD'), 3);
assert.equal(unitOf('KWD'), 1000);
assert.equal(digitsOf('JPY'), 0);
assert.equal(unitOf('JPY'), 1);
assert.equal(format(1500, 'KWD'), 'KD\u00a02');                        // 1.500 KD rounds to 2 whole
assert.equal(format(1500, 'KWD', { paise: true }), 'KD\u00a01.500');
assert.equal(format(234050, 'INR', { paise: true }), '₹2,340.50');   // the accounting form
assert.equal(format(21560000, 'INR', { paise: true }), '₹2,15,600.00');
assert.equal(format(1250, 'JPY'), '¥1,250');
assert.equal(format(1250, 'JPY', { paise: true }), '¥1,250');
assert.equal(format(123456, 'SAR', { paise: true }), '\u20C11,234.56');  // the 2025 riyal sign
assert.equal(fromKeys('1.5', 'KWD'), 1500);
assert.equal(fromKeys('1.500', 'KWD'), 1500);
assert.equal(fromKeys('1.5005', 'KWD'), 1500);                        // a fourth digit is dropped, not rounded
assert.equal(fromKeys('1250', 'JPY'), 1250);
assert.equal(fromKeys('1250.9', 'JPY'), 1250);
assert.equal(keysDisplay('1.5', 'KWD'), '1.5');
assert.equal(keysDisplay('1250.9', 'JPY'), '1,250');
assert.equal(pushKey('1.500', '5', 'KWD'), '1.500');
assert.equal(pushKey('1250', '.', 'JPY'), '1250');

// Minor units back to keys, for a field editing what is already recorded.
assert.equal(toKeys(150000), '1500');
assert.equal(toKeys(150050), '1500.50');
assert.equal(toKeys(150005), '1500.05');
assert.equal(toKeys(-150050), '1500.50');
assert.equal(toKeys(1500, 'KWD'), '1.500');
assert.equal(toKeys(1250, 'JPY'), '1250');
assert.equal(toKeys(0), '0');

// The phone's own keyboard: whatever arrives is tidied into keys.
assert.equal(typed('2340'), '2340');
assert.equal(typed('2,340'), '2340');                 // a comma the person typed
assert.equal(typed('₹2,340.5'), '2340.5');            // a symbol pasted in
assert.equal(typed('2340.555'), '2340.55');           // two paise digits at most
assert.equal(typed('23.4.5'), '23.45');               // one point
assert.equal(typed('.5'), '0.5');
assert.equal(typed('007'), '7');
assert.equal(typed('0'), '0');
assert.equal(typed(''), '');
assert.equal(typed('1234567890'), '123456789');       // nine digits is the ceiling
assert.equal(typed('1.5005', 'KWD'), '1.500');
assert.equal(typed('1250.5', 'JPY'), '1250');

// Leaving the field settles it into the accounting form.
assert.equal(settleKeys('2340'), '2340.00');
assert.equal(settleKeys('2340.5'), '2340.50');
assert.equal(settleKeys('2340.'), '2340.00');
assert.equal(settleKeys('.5'), '0.50');
assert.equal(settleKeys(''), '');
assert.equal(settleKeys('1.5', 'KWD'), '1.500');
assert.equal(settleKeys('1250', 'JPY'), '1250');
assert.equal(keysDisplay(settleKeys('215600.5')), '2,15,600.50');
assert.equal(fromKeys(settleKeys('2340.5')), 234050);

// Every currency is well formed: a three-letter code, a symbol, and digits
// the ledger can divide by.
for (const x of CURRENCIES) {
  assert.match(x.code, /^[A-Z]{3}$/);
  assert.ok(x.symbol.length > 0, x.code);
  assert.ok([0, 2, 3].includes(x.digits), x.code);
  assert.ok(!/ $/.test(x.symbol), `${x.code}: an ordinary space would wrap`);
}
assert.equal(new Set(CURRENCIES.map((x) => x.code)).size, CURRENCIES.length);
console.log(`money: ${CURRENCIES.length} currencies, 52 more assertions passed`);
