// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { isOtp, parseSms, bodyHash, validateCapture } = await import(`${process.env.LIB}/sms.js`);
const { EDGE_FIXTURES, BANK_FIXTURES, OTP_FIXTURES, PROMO_FIXTURES } = await import(`${process.env.LIB}/sms.fixtures.js`);

// Every bank and UPI fixture parses to exactly what the table says, and is no OTP.
for (const x of BANK_FIXTURES) {
  assert.deepEqual(parseSms(x.text, x.sender), x.expect, `${x.source} ${x.kind}: ${x.text}`);
  assert.equal(isOtp(x.text), false, `not an OTP: ${x.text}`);
}
for (const x of EDGE_FIXTURES) {
  assert.deepEqual(parseSms(x.text, x.sender), x.expect, `edge: ${x.text}`);
  assert.equal(isOtp(x.text), false, `not an OTP: ${x.text}`);
}
// OTPs are recognised in every style, and an amount inside one does not rescue it.
for (const t of OTP_FIXTURES) assert.equal(isOtp(t), true, t);
assert.equal(isOtp('OTP for txn of Rs 500 is 123456'), true);
assert.equal(isOtp('Rs 500 debited from A/c XX1234. OTP for the txn is 123456'), true);
// Promotions mention money but are not transactions.
for (const t of PROMO_FIXTURES) {
  const p = parseSms(t);
  assert.equal(p.direction, null, t);
  assert.equal(p.amountMinor, null, t);
  assert.equal(isOtp(t), false, t);
}

// Amount forms.
const amt = (s) => parseSms(s).amountMinor;
assert.equal(amt('Rs:500 debited'), 50000);
assert.equal(amt('Rs 1,00,000.123 debited'), null);      // 3 decimals only for 3-digit currencies
assert.equal(amt('KWD 1.250 spent'), 1250);
assert.equal(amt('INR 1,234.5 debited'), 123450);
assert.equal(amt('₹ 12,34,567.89 credited'), 123456789);
assert.equal(amt('Rs 1,234,567 credited'), 123456700);
assert.equal(amt('USD 12.30 spent'), 1230);
assert.equal(amt('KWD 1.250 spent'), 1250);
// A balance figure is never the amount, whichever side of the verb it sits.
assert.equal(amt('Avl Bal Rs 5,000.00. Rs 100.00 debited from A/c XX1234'), 10000);
assert.equal(amt('Rs 100.00 debited. Available balance: Rs 5,000.00'), 10000);
assert.equal(amt('Rs 5,000 debited. Bal Rs 90,000'), 500000);
// The amount nearest the verb wins.
assert.equal(amt('Limit Rs 50,000 set. Rs 200 spent at SHOP'), 20000);
// A message with no verb has no direction and no amount.
assert.deepEqual(parseSms('Rs 500 at SHOP'), { amountMinor: null, currency: null, direction: null, last4: null, merchant: 'SHOP', date: null });

// last4: four digits only.
const l4 = (s) => parseSms(s).last4;
assert.equal(l4('A/c XX1234 debited Rs 1'), '1234');
assert.equal(l4('a/c no. XXXXXX1234 debited Rs 1'), '1234');
assert.equal(l4('Card XX1234 spent Rs 1'), '1234');
assert.equal(l4('card ending 1234 spent Rs 1'), '1234');
assert.equal(l4('Rs 1 debited, ref 1234567'), null);

// Dates: DD-MM for India; invalid or impossible is null.
const dt = (s) => parseSms(`Rs 1 debited on ${s}`).date;
assert.equal(dt('06-11-26'), '2026-11-06');
assert.equal(dt('06Nov26'), '2026-11-06');
assert.equal(dt('06/11/2026'), '2026-11-06');
assert.equal(dt('2026-11-06'), '2026-11-06');
assert.equal(dt('06 Nov 2026'), '2026-11-06');
assert.equal(dt('31-02-26'), null);
assert.equal(dt('06/13/2026'), null);
assert.equal(dt('2026-13-01'), null);
assert.equal(parseSms('Rs 1 debited').date, null);

// Merchant is trimmed to 40 characters.
const long = parseSms(`Rs 1 paid to ${'A'.repeat(30)} ${'B'.repeat(30)} on 06-11-26`);
assert.equal(long.merchant.length, 40);

// A hostile body must not throw or hang.
assert.doesNotThrow(() => parseSms('Rs ' + '9,'.repeat(5000) + ' debited ' + 'to '.repeat(2000)));

// bodyHash is stable across whitespace and is sha256 hex.
assert.equal(bodyHash('a  b\n'), bodyHash('a b'));
assert.equal(bodyHash('  a \t\n b '), bodyHash('a b'));
assert.notEqual(bodyHash('a b'), bodyHash('a c'));
assert.match(bodyHash('a b'), /^[0-9a-f]{64}$/);

// validateCapture.
const ok = validateCapture({ text: '  Rs 5 debited  ', sender: 'HDFCBK', received_at: '2026-11-06T08:15:22+05:30' });
assert.deepEqual(ok, { text: 'Rs 5 debited', sender: 'HDFCBK', receivedAt: '2026-11-06T08:15:22+05:30' });
assert.deepEqual(validateCapture({ text: 'x' }), { text: 'x', sender: null, receivedAt: null });
assert.deepEqual(validateCapture({ text: 'x', sender: null, received_at: null }), { text: 'x', sender: null, receivedAt: null });
assert.deepEqual(validateCapture({ text: 'x', received_at: '2026-11-06T08:15:22.123Z' }).receivedAt, '2026-11-06T08:15:22.123Z');
assert.deepEqual(validateCapture({ text: 'x'.repeat(2000) }).text.length, 2000);
assert.deepEqual(validateCapture({ text: 'x'.repeat(2001) }), { error: 'size' });
assert.deepEqual(validateCapture({ text: '   ' }), { error: 'size' });
assert.deepEqual(validateCapture({ text: 'x', sender: 's'.repeat(64) }).sender, 's'.repeat(64));
assert.deepEqual(validateCapture({ text: 'x', sender: 's'.repeat(65) }), { error: 'size' });
for (const bad of [null, undefined, 'text', 5, true, [], [{ text: 'x' }], () => 1]) assert.deepEqual(validateCapture(bad), { error: 'shape' });
assert.deepEqual(validateCapture({}), { error: 'shape' });
assert.deepEqual(validateCapture({ text: 5 }), { error: 'shape' });
assert.deepEqual(validateCapture({ text: ['x'] }), { error: 'shape' });
assert.deepEqual(validateCapture({ text: 'x', sender: 5 }), { error: 'shape' });
assert.deepEqual(validateCapture({ text: 'x', received_at: 5 }), { error: 'shape' });
assert.deepEqual(validateCapture({ text: 'x', received_at: 'yesterday' }), { error: 'shape' });
assert.deepEqual(validateCapture({ text: 'x', received_at: '2026-02-30T08:00:00Z' }), { error: 'shape' });
assert.deepEqual(validateCapture({ text: 'x', received_at: '2026-11-06T25:00:00Z' }), { error: 'shape' });
// Prototype keys: inherited or planted ones are not the caller's fields.
assert.deepEqual(validateCapture(JSON.parse('{"__proto__":{"text":"evil"}}')), { error: 'shape' });
assert.deepEqual(validateCapture(JSON.parse('{"text":"x","__proto__":{"sender":"evil"},"constructor":1}')), { text: 'x', sender: null, receivedAt: null });
assert.deepEqual(validateCapture(Object.create({ text: 'inherited' })), { error: 'shape' });
assert.deepEqual(validateCapture(new Date()), { error: 'shape' });


// Hostile bodies finish quickly: nothing here may back-track.
const S = (n) => ' '.repeat(n);
const hostile = [
  'card' + S(1990) + 'x', 'bal' + S(1990) + 'x', 'a/c' + S(1990) + 'x', 'Rs' + S(1990) + 'x', 'to' + S(1990) + 'x', 'at' + S(1990) + 'x',
  'card ' + '1'.repeat(1990) + 'x', 'card 12345 '.repeat(180), 'bal ' .repeat(500), 'card '.repeat(400),
  'balance' + S(800) + 'is' + S(800) + 'Rs' + S(300), 'Rs ' + '9,'.repeat(995), 'Rs 1 '.repeat(400) + ' debited '.repeat(20),
  'to '.repeat(660), 'is '.repeat(660), 'a/c '.repeat(500), '1-1-'.repeat(500), 'UPI/1/' + 'a'.repeat(1990), 'UPI/1/a '.repeat(240),
  'a'.repeat(1990) + ' sent', 'code ' + '1'.repeat(1990), '1234 '.repeat(390), 'OTP' + S(1990) + '1', 'OTP '.repeat(480), 'OTP is :- '.repeat(190), 'OTP for txn of Rs 5 '.repeat(95), 'OTP' + ':-'.repeat(990), 'bal Rs ' + S(1000) + '9'.repeat(900),
];
for (const h of hostile) {
  const t0 = performance.now();
  parseSms(h); isOtp(h);
  const ms = performance.now() - t0;
  assert.ok(ms < 50, `${ms.toFixed(1)}ms for ${h.slice(0, 30)}`);
}
console.log('sms: ok');
