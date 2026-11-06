// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const P = await import(`${process.env.LIB}/prices.js`);
const { CURRENCIES } = await import(`${process.env.LIB}/money.js`);
const { parseFx, parseMetal, CURRENCY_DIGITS_SQL_3, CURRENCY_DIGITS_SQL_0, fxAsOf, metalAsOf } = P;
const d = '2026-11-05';

// FX: rates are OTHER per 1 INR, so the price of a USD in INR is 1/rate.
assert.deepEqual(parseFx({ result: 'success', rates: { USD: 0.012 } }, 'INR', ['USD'], d),
  [{ base: 'USD', quote: 'INR', rate: '83.3333333333', asOf: d }]);
const bad = parseFx({ result: 'success', rates: { USD: 0.012, AED: 0, GBP: -1, EUR: NaN, SAR: Infinity, JPY: '1.2' } },
  'INR', ['USD', 'AED', 'GBP', 'EUR', 'SAR', 'JPY', 'CAD'], d);
assert.deepEqual(bad.map((q) => q.base), ['USD']);                       // zero, negative, NaN, Infinity, string, missing
for (const j of [null, undefined, 5, 'x', [], {}, { rates: { USD: 1 } }, { result: 'error', rates: { USD: 1 } },
  { result: 'success', rates: null }, { result: 'success', rates: [1] }]) assert.deepEqual(parseFx(j, 'INR', ['USD'], d), []);
assert.deepEqual(parseFx({ result: 'success', rates: { USD: 1e-10 } }, 'INR', ['USD'], d), []);   // 1e10 ≥ 1e9
assert.deepEqual(parseFx({ result: 'success', rates: { USD: 1e12 } }, 'INR', ['USD'], d), []);    // rounds to 0
assert.deepEqual(parseFx({ result: 'success', rates: { constructor: 2, USD: 2 } }, 'INR', ['constructor', 'toString', 'USD', 'lower', 'INR'], d)
  .map((q) => q.base), ['USD']);                                          // own keys, valid codes, not the quote itself
for (const q of parseFx({ result: 'success', rates: { USD: 0.0119137 } }, 'INR', ['USD'], d))
  assert.match(q.rate, /^\d+\.\d{10}$/);

// Metals: USD per troy ounce → per gram × quote-per-USD.
const m = parseMetal({ price: 2488.2 }, 'XAU', '84', d, 'INR');
assert.equal(m.base, 'XAU'); assert.equal(m.quote, 'INR'); assert.equal(m.asOf, d);
assert.equal(Number(m.rate).toFixed(4), (2488.2 / 31.1034768 * 84).toFixed(4));
assert.match(m.rate, /^6719\.\d{1,10}$/);
assert.equal(parseMetal({}, 'XAU', '84', d), null);
for (const j of [null, 3, [], { price: 0 }, { price: -1 }, { price: '5' }, { price: NaN }, { price: 1e12 }, { price: 10, currency: 'EUR' }])
  assert.equal(parseMetal(j, 'XAG', '84', d), null);
assert.equal(parseMetal({ price: 10 }, 'XAG', '0', d), null);
assert.equal(parseMetal({ price: 10 }, 'XAG', 'abc', d), null);

// Real-shaped fixtures from each provider (extra fields ignored).
const erApi = { result: 'success', provider: 'https://www.exchangerate-api.com', time_last_update_unix: 1793836951,
  time_last_update_utc: 'Thu, 05 Nov 2026 00:02:31 +0000', time_next_update_unix: 1793924021, base_code: 'INR',
  rates: { INR: 1, USD: 0.011914, AED: 0.04375, SAR: 0.044678, KWD: 0.003657 } };
const gold = { currency: 'USD', currencySymbol: '$', exchangeRate: 1, name: 'Gold', price: 4069.6, symbol: 'XAU',
  updatedAt: '2026-11-05T09:30:12Z', updatedAtReadable: 'a few seconds ago' };
const fx = parseFx(erApi, 'INR', ['USD', 'AED', 'KWD', 'INR'], '2026-11-05');
assert.deepEqual(fx.map((q) => q.base), ['USD', 'AED', 'KWD']);
assert.equal(fx[0].rate, (1 / 0.011914).toFixed(10));
const g = parseMetal(gold, 'XAU', fx[0].rate, '2026-11-05', 'INR');
assert.equal(Number(g.rate).toFixed(2), (4069.6 / 31.1034768 * (1 / 0.011914)).toFixed(2));

// Provider dates, as UTC; missing, invalid or future fall back to null.
assert.equal(fxAsOf(erApi), new Date(1793836951000).toISOString().slice(0, 10));
assert.equal(metalAsOf(gold), '2026-11-05');
for (const j of [null, {}, { time_last_update_unix: 'x' }, { time_last_update_unix: NaN }, { time_last_update_unix: 1e18 }]) assert.equal(fxAsOf(j), null);
for (const j of [null, {}, { updatedAt: 5 }, { updatedAt: 'nope' }, { updatedAt: '2999-01-01T00:00:00Z' }]) assert.equal(metalAsOf(j), null);

// The digit lists are money.ts's, and are the lists in the SQL function. A
// third copy can't drift in silence: all three are compared.
const by = (n) => CURRENCIES.filter((c) => c.digits === n).map((c) => c.code).sort();
assert.deepEqual([...CURRENCY_DIGITS_SQL_3].sort(), by(3));
assert.deepEqual([...CURRENCY_DIGITS_SQL_0].sort(), by(0));
const sqlText = readFileSync(fileURLToPath(new URL('../../drizzle/0110_views_holdings.sql', import.meta.url)), 'utf8');
const sqlList = (n) => {
  const mm = new RegExp(`WHEN code IN \\(([^)]*)\\) THEN ${n}\\b`).exec(sqlText);
  assert.ok(mm, `0110 has a list for ${n} digits`);
  return [...mm[1].matchAll(/'([A-Z]{3})'/g)].map((x) => x[1]).sort();
};
assert.deepEqual(sqlList(3), [...CURRENCY_DIGITS_SQL_3].sort());
assert.deepEqual(sqlList(0), [...CURRENCY_DIGITS_SQL_0].sort());
console.log('  prices: ok');
