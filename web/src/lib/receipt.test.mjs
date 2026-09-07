// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { readScan, whatIsMissing } = await import(`${process.env.LIB}/receipt.js`);

const ok = (o) => JSON.stringify(o);
const year = new Date().getFullYear();

// ── the ordinary case ──────────────────────────────────────────────────────
let s = readScan(ok({ kind: 'expense', amount: 1840.5, date: `${year}-09-07`,
  merchant: 'Star Bazaar', category: 'groceries', confidence: 'high', note: null }));
assert.equal(s.kind, 'expense');
assert.equal(s.amountMinor, 184050, 'rupees become paise as an integer');
assert.equal(s.occurredOn, `${year}-09-07`);
assert.equal(s.merchant, 'Star Bazaar');
assert.deepEqual(whatIsMissing(s), []);

// Models wrap JSON in fences often enough that it has to be handled.
s = readScan('```json\n{"kind":"income","amount":"₹ 12,500","date":null,"confidence":"medium"}\n```');
assert.equal(s.kind, 'income');
assert.equal(s.amountMinor, 1250000, 'currency symbols and commas are stripped');
assert.equal(s.occurredOn, null);
assert.deepEqual(whatIsMissing(s), ['the date']);

// ── what must NOT be accepted ──────────────────────────────────────────────
assert.ok('error' in readScan('sorry, I cannot read that image'), 'prose is refused');
assert.ok('error' in readScan('{ broken'), 'malformed JSON is refused');

s = readScan(ok({ kind: 'transfer', amount: 100, date: `${year}-01-01`, confidence: 'high' }));
assert.equal(s.kind, 'unknown', 'a kind outside the two we accept becomes unknown');
assert.ok(whatIsMissing(s).includes('whether money went out or came in'),
  'and an unknown kind always blocks the save');

for (const bad of [0, -50, 1e12, 'abc', null, undefined, {}]) {
  assert.equal(readScan(ok({ kind: 'expense', amount: bad, date: `${year}-01-01` })).amountMinor,
    null, `an amount of ${JSON.stringify(bad)} is refused rather than coerced`);
}
for (const bad of ['1999-01-01', '2190-01-01', '07-09-2026', 'yesterday', '', null]) {
  assert.equal(readScan(ok({ kind: 'expense', amount: 10, date: bad })).occurredOn,
    null, `a date of ${JSON.stringify(bad)} is refused`);
}

// Long fields are cut, not trusted to be sensible.
s = readScan(ok({ kind: 'expense', amount: 10, date: `${year}-01-01`,
  merchant: 'x'.repeat(200), note: 'y'.repeat(500), category: 'GROCERIES' }));
assert.equal(s.merchant.length, 60);
assert.equal(s.note.length, 200);
assert.equal(s.categoryHint, 'groceries', 'the category hint is lowercased');

// Confidence is only believed when it is one of the words we asked for.
assert.equal(readScan(ok({ kind: 'expense', amount: 1, date: `${year}-01-01`,
  confidence: 'very high' })).confidence, 'low', 'an unrecognised confidence is treated as low');

console.log('  ok   reading a scan, and refusing what will not parse');
