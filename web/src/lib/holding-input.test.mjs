// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { canWrite, gramsToMg, purityPermille, parseRate, fxQuantity, dateProblem } = await import(`${process.env.LIB}/holding-input.js`);

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

// commas group digits; they are never a decimal point
assert.deepEqual(gramsToMg('1,000.5'), { ok: true, mg: 1000500 });
assert.deepEqual(gramsToMg('12,50,000'), { ok: true, mg: 1250000000 });
assert.deepEqual(fxQuantity('12,50,000.50', 'USD'), { ok: true, minor: 125000050 });
assert.deepEqual(parseRate('1,234.5'), { ok: true, rate: '1234.5' });
// a grouping never starts with a zero group: 0,001 is not a thousandth, it is a typo
for (const f of [gramsToMg, (v) => fxQuantity(v, 'USD'), parseRate]) {
  for (const bad of ['0,001', '0,000', '00,001', '01,000', '0,00,000', '0,000.5']) {
    const r = f(bad);
    assert.equal(r.ok, false, `leading-zero group ${bad}`);
    assert.match(r.error, /Use a point for decimals, like 12\.5/);
  }
}
assert.deepEqual(gramsToMg('1,000'), { ok: true, mg: 1000000 });
assert.deepEqual(parseRate('1,000'), { ok: true, rate: '1000' });
assert.deepEqual(gramsToMg('10,00,000'), { ok: true, mg: 1000000000 });
assert.deepEqual(gramsToMg('999,999'), { ok: true, mg: 999999000 });
for (const bad of ['12,5', '1,2,3', '1,00', '1234,567', ',5', '5,', '1.000,5', '1,000,00', '12,5.5']) {
  for (const r of [gramsToMg(bad), fxQuantity(bad, 'USD'), parseRate(bad)]) {
    assert.equal(r.ok, false, `comma rejects ${bad}`);
    assert.match(r.error, /Use a point for decimals, like 12\.5/);
  }
}
// no prototype lookups
for (const p of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
  assert.equal(purityPermille('gold', p).ok, false, p);
  assert.equal(purityPermille('silver', p).ok, false, p);
}
assert.equal(purityPermille('constructor', '999').ok, false);
// dates before 1900 are refused
assert.ok(dateProblem('1899-12-31', '2026-11-06'));
assert.equal(dateProblem('1900-01-01', '2026-11-06'), null);
// writers are an allow-list
assert.equal(canWrite('owner'), true);
assert.equal(canWrite('adult'), true);
for (const r of ['viewer', '', 'admin', undefined, null, 'constructor', 'OWNER']) assert.equal(canWrite(r), false, String(r));
console.log('  holding-input ok');

// ---- labels ----
{
  const { gramsLabel, purityLabel, rateLabel, dayLabel } = await import(`${process.env.LIB}/holding-input.js`);
  for (const [mg, out] of [[50000, '50'], [12500, '12.5'], [1, '0.001'], [0, '0'], [1250125, '1,250.125'], ['50000', '50'], [1010, '1.01']]) {
    assert.equal(gramsLabel(mg), out, `grams label ${mg}`);
  }
  for (const [m, p, out] of [['gold', 999, '24k'], ['gold', 916, '22k'], ['gold', 750, '18k'], ['gold', 585, '14k'],
    ['silver', 925, 'Sterling'], ['silver', 999, 'Fine']]) assert.equal(purityLabel(m, p), out, `${m} ${p}`);
  for (const [r, out] of [['84', '84.00'], ['84.1234', '84.12'], ['12345.6', '12,345.60'], ['0.012', '0.0120'],
    ['0.5', '0.500'], ['0.0000123', '0.0000123'], ['1000000', '1,000,000.00']]) assert.equal(rateLabel(r), out, `rate ${r}`);
  assert.equal(rateLabel(null), '');
  assert.equal(rateLabel('1e3'), '');
  assert.equal(dayLabel('2026-11-06'), '6 Nov');
  assert.equal(dayLabel('2026-01-31T00:00:00'), '31 Jan');
  assert.equal(dayLabel(null), '');
  console.log('  holding labels: ok');
}
