// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { gramsToMg, purityPermille, parseRate, fxQuantity, dateProblem } = await import(`${process.env.LIB}/holding-input.js`);

// grams -> integer milligrams, by string arithmetic
for (const [typed, mg] of [['0', 0], ['1', 1000], ['12.5', 12500], ['12.500', 12500], ['0.001', 1], ['.5', 500],
  ['5.', 5000], [' 1,250.125 ', 1250125], ['0.1', 100], ['1.005', 1005], ['99999999.999', 99999999999]]) {
  assert.deepEqual(gramsToMg(typed), { ok: true, mg }, `grams ${typed}`);
}
for (const bad of ['', ' ', '.', '-1', '-0.5', '1.2345', '0.0001', 'abc', '1e3', '1.2.3', '12g', '1 000', '--1', '+1', '1000000000000']) {
  const r = gramsToMg(bad);
  assert.equal(r.ok, false, `grams rejects ${JSON.stringify(bad)}`);
  assert.ok(r.error.length > 10 && !/undefined|NaN/.test(r.error), 'a sentence');
}
assert.equal(gramsToMg(null).ok, false);

// karat or fineness; only the offered values
for (const [m, p, out] of [['gold', '24k', 999], ['gold', '22K', 916], ['gold', '22', 916], ['gold', '18k', 750], ['gold', '14k', 585],
  ['gold', '999', 999], ['gold', '916', 916], ['gold', '750', 750], ['gold', '585', 585],
  ['silver', '999', 999], ['silver', '925', 925], ['silver', 'sterling', 925]]) {
  assert.deepEqual(purityPermille(m, p), { ok: true, permille: out }, `${m} ${p}`);
}
for (const [m, p] of [['gold', '20k'], ['gold', '925'], ['gold', ''], ['gold', '1000'], ['silver', '916'], ['silver', '22k'],
  ['silver', ''], ['platinum', '950'], ['gold', '-916'], ['gold', '9.99']]) {
  assert.equal(purityPermille(m, p).ok, false, `${m} ${p} rejected`);
}

// a rate stays a string; positive, <= 10 places, < 1e9
for (const [typed, out] of [['271.5', '271.5'], [' 8000 ', '8000'], ['0.0000000001', '0.0000000001'], ['999999999.9999999999', '999999999.9999999999'],
  ['0.55', '0.55'], ['5.', '5'], ['.5', '0.5'], ['007', '7'], ['1,234.5', '1234.5']]) {
  assert.deepEqual(parseRate(typed), { ok: true, rate: out }, `rate ${typed}`);
}
for (const bad of ['', '0', '0.0', '0.00000000001', '1000000000', '-1', '1e3', 'abc', '1.2.3', '12345678901', null, '0.00000000000']) {
  assert.equal(parseRate(bad).ok, false, `rate rejects ${JSON.stringify(bad)}`);
}

// fx quantity: the currency's own digits, no negatives, no junk
assert.deepEqual(fxQuantity('1,500.25', 'USD'), { ok: true, minor: 150025 });
assert.deepEqual(fxQuantity('1.500', 'KWD'), { ok: true, minor: 1500 });
assert.deepEqual(fxQuantity('500', 'JPY'), { ok: true, minor: 500 });
assert.deepEqual(fxQuantity('0', 'USD'), { ok: true, minor: 0 });
for (const [t, c] of [['-5', 'USD'], ['abc', 'USD'], ['', 'USD'], ['1.234', 'USD'], ['0.5', 'JPY'], ['1e3', 'USD'], ['99999999999999999', 'USD']]) {
  assert.equal(fxQuantity(t, c).ok, false, `fx ${t} ${c}`);
}

// dates
assert.equal(dateProblem('2026-11-06', '2026-11-06'), null);
assert.equal(dateProblem('2026-11-05', '2026-11-06'), null);
assert.match(dateProblem('2026-11-07', '2026-11-06'), /future/);
for (const bad of ['', 'yesterday', '2026-02-30', '2026-13-01', '06/11/2026']) assert.ok(dateProblem(bad, '2026-11-06'), bad);
console.log('  holding-input ok');
