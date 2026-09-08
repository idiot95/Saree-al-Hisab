// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { toHijri, fromHijri, hijriDaysInMonth, isKabisa, civilToJdn, jdnToCivil, formatHijri } =
  await import(`${process.env.LIB}/hijri/index.js`);

// ── the Gregorian side, against JavaScript's own calendar ──────────────────
for (let jdn = 2451545 - 40000; jdn < 2451545 + 40000; jdn += 97) {
  const c = jdnToCivil(jdn);
  const js = new Date(Date.UTC(c.y, c.m - 1, c.d));
  assert.equal(js.getUTCFullYear(), c.y); assert.equal(js.getUTCMonth() + 1, c.m); assert.equal(js.getUTCDate(), c.d);
  assert.equal(civilToJdn(c), jdn);
}
assert.equal(civilToJdn({ y: 2000, m: 1, d: 1 }), 2451545, 'J2000');

// ── the shape of a Misri year ──────────────────────────────────────────────
assert.equal(hijriDaysInMonth(1447, 1), 30); assert.equal(hijriDaysInMonth(1447, 2), 29);
assert.equal(hijriDaysInMonth(1447, 9), 30, 'Ramadaan is always 30');
assert.ok(isKabisa(1448) === (1448 % 30 === 8), 'the eighth year of a cycle is Kabisa in the Misri reckoning');
assert.equal(hijriDaysInMonth(1448, 12), isKabisa(1448) ? 30 : 29);
const daysIn = (y) => Array.from({ length: 12 }, (_, i) => hijriDaysInMonth(y, i + 1)).reduce((a, b) => a + b);
assert.equal(daysIn(1447) + (isKabisa(1447) ? 0 : 0), isKabisa(1447) ? 355 : 354);
let cycle = 0; for (let y = 1440; y < 1470; y++) cycle += daysIn(y);
assert.equal(cycle, 10631, 'thirty years are 10631 days');

// ── epoch and round trips ──────────────────────────────────────────────────
assert.deepEqual(fromHijri({ y: 1, m: 1, d: 1 }), jdnToCivil(1948439), '1 Moharram 1 is JDN 1948439');
for (let jdn = 2440000; jdn < 2480000; jdn += 13) {
  const h = toHijri(jdnToCivil(jdn));
  assert.ok(h.m >= 1 && h.m <= 12 && h.d >= 1 && h.d <= hijriDaysInMonth(h.y, h.m), `${jdn} → ${JSON.stringify(h)}`);
  assert.equal(civilToJdn(fromHijri(h)), jdn, 'round trip');
}
// Consecutive days are consecutive dates, across every month and year end.
let prev = toHijri(jdnToCivil(2455000));
for (let jdn = 2455001; jdn < 2466000; jdn++) {
  const h = toHijri(jdnToCivil(jdn));
  const expectNext = prev.d < hijriDaysInMonth(prev.y, prev.m)
    ? { y: prev.y, m: prev.m, d: prev.d + 1 }
    : prev.m < 12 ? { y: prev.y, m: prev.m + 1, d: 1 } : { y: prev.y + 1, m: 1, d: 1 };
  assert.deepEqual(h, expectNext, `day after ${JSON.stringify(prev)}`);
  prev = h;
}

// ── against the original library, over three centuries ────────────────────
// A checked-in table: (JDN, y, m, d) triples produced by @mygulamali/hijri_date
// 0.0.2, so the port cannot drift from the calendar the community publishes.
const { readFileSync } = await import('node:fs');
const table = readFileSync(new URL('./hijri.reference.tsv', import.meta.url), 'utf8').trim().split('\n');
assert.ok(table.length > 1000, 'the reference table is present');
for (const line of table) {
  const [jdn, y, m, d] = line.split('\t').map(Number);
  assert.deepEqual(toHijri(jdnToCivil(jdn)), { y, m, d }, `JDN ${jdn}`);
}

assert.equal(formatHijri({ y: 1448, m: 3, d: 21 }), '21 Rabi al-Awwal 1448');
assert.equal(formatHijri({ y: 1448, m: 9, d: 1 }, true), '1 Ramadaan 1448');
console.log('  ok   the Misri calendar, both ways, against the original');
