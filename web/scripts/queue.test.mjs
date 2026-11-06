/* The offline queue, proved without a browser: src/app/add/queue.ts run as written (tsx strips its types) against
   a faked localStorage. Run: npx tsx scripts/queue.test.mjs (test:lib runs it too).

   The case that matters most: an entry queued on a phone by an OLDER build of Add Entry — the two-step wizard,
   and the build before it that sent a bare rail id as `methodId` — must still drain through saveEntry exactly as
   it was written. The one-screen form changed what the screen looks like, not the Draft it sends, and a phone can
   hold a queued entry across an app update for as long as it stays out of signal.                              */
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const listeners = new Map();
globalThis.addEventListener = (t, fn) => listeners.set(t, [...(listeners.get(t) ?? []), fn]);
globalThis.removeEventListener = (t, fn) => listeners.set(t, (listeners.get(t) ?? []).filter((f) => f !== fn));
globalThis.dispatchEvent = (e) => { for (const fn of listeners.get(e.type) ?? []) fn(e); return true; };

const q = await import('../src/app/add/queue.ts');

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };

const HH = '11111111-1111-4111-8111-111111111111';
/* Exactly what the two-step wizard wrote into ql.queue.v1 (AddEntry before Task 18): enqueue({...draft,
   attachments: null}, householdId). Field for field, as JSON. */
const wizard = {
  kind: 'expense', amountMinor: 234000, categoryId: '22222222-2222-4222-8222-222222222222',
  paidWith: 'm:33333333-3333-4333-8333-333333333333', counterAccountId: null, merchant: 'Ratnadeep', note: '',
  occurredOn: '2026-11-05', isShared: true, attachments: null, tabId: null, tabCoveredMinor: null,
  countsAsSpend: null, settles: [],
  householdId: HH, clientRef: '44444444-4444-4444-8444-444444444444', queuedAt: '2026-11-05T09:12:00.000Z',
};
/* And the build before that: a rail id on its own, no note, no tabs, no settles. */
const older = {
  kind: 'expense', amountMinor: 5000, categoryId: '22222222-2222-4222-8222-222222222222',
  methodId: '33333333-3333-4333-8333-333333333333', counterAccountId: null, merchant: '',
  occurredOn: '2026-10-01', isShared: false,
  householdId: HH, clientRef: '55555555-5555-4555-8555-555555555555', queuedAt: '2026-10-01T08:00:00.000Z',
};
store.set('ql.queue.v1', JSON.stringify([wizard, older]));

const sent = [];
const r = await q.drain(async (d) => { sent.push(d); return { ok: true, id: crypto.randomUUID() }; });
assert.deepEqual(r, { sent: 2, stuck: 0, left: 0 });
ok('both old-shape entries drain');
assert.deepEqual(sent[0], wizard);
ok('the wizard\'s entry reaches saveEntry exactly as it was queued, field for field');
assert.deepEqual(sent[1], older);
ok('so does the methodId-era entry (saveEntry reads paidWith ?? methodId)');
assert.equal(store.get('ql.queue.v1'), '[]');
ok('and both leave the phone once accepted');

// The drain rules still hold: a refusal is kept with its reason and skipped next time; a network failure stops.
store.set('ql.queue.v1', JSON.stringify([wizard, older]));
const r2 = await q.drain(async (d) => (d.clientRef === wizard.clientRef
  ? { ok: false, error: 'That category is not one of yours.' } : { ok: true, id: 'x' }));
assert.deepEqual(r2, { sent: 1, stuck: 1, left: 1 });
assert.equal(q.readQueue()[0].stuck, 'That category is not one of yours.');
ok('a refused entry stays, marked stuck with the reason');
let calls = 0;
const r3 = await q.drain(async () => { calls++; return { ok: true, id: 'x' }; });
assert.equal(calls, 0); assert.deepEqual(r3, { sent: 0, stuck: 1, left: 1 });
ok('a stuck entry is never retried on its own');

store.set('ql.queue.v1', JSON.stringify([older, wizard]));
const r4 = await q.drain(async () => { throw new TypeError('Failed to fetch'); });
assert.deepEqual(r4, { sent: 0, stuck: 0, left: 2 });
ok('no signal: the drain stops and keeps everything');

// What the new screen queues has the same keys as what the wizard queued — nothing renamed, nothing required.
const fresh = q.enqueue({
  kind: 'transfer', amountMinor: 100000, categoryId: null, paidWith: 'a:66666666-6666-4666-8666-666666666666',
  counterAccountId: '77777777-7777-4777-8777-777777777777', merchant: '', note: '', occurredOn: '2026-11-06',
  isShared: true, attachments: null, tabId: null, tabCoveredMinor: null, countsAsSpend: null, settles: [],
}, HH);
assert.deepEqual(Object.keys(fresh).sort(), Object.keys(wizard).sort());
ok('a new entry is queued with exactly the wizard\'s keys');

// Pickers from before the one-screen form (no top, no paidWith) still read.
store.set('ql.pickers.v1', JSON.stringify({ householdId: HH, categories: [], ways: [], savedAt: 'x' }));
assert.equal(q.readPickers().top, undefined);
ok('an older pickers snapshot reads, with no ranking');

console.log(`\n  queue: ${n} passed\n`);
