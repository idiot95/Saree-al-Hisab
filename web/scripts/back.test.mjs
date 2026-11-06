/* Back, proved without a browser: src/app/entries/back.ts (where an entry may return to) and src/app/backStack.ts
   (the session's trail) run as written through tsx, against a faked sessionStorage.
   Run: npx tsx scripts/back.test.mjs (test:lib runs it too). */
import assert from 'node:assert/strict';

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const { safeBack } = await import('../src/app/entries/back.ts');
const trail = await import('../src/app/backStack.ts');

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const ID = '5eed0000-0000-4000-8000-000000000600';

/* ── safeBack: an exact list ─────────────────────────────────────────── */
for (const to of ['/', '/entries', '/accounts', '/people', `/tab/${ID}`, `/people/${ID}`,
  '/entries?f=review', '/entries?f=upcoming', '/entries?f=sms']) assert.equal(safeBack(to), to, to);
ok('safeBack keeps every screen on the list: Home, Activity, Accounts, Loans, a tab, a person, the three chips');
for (const to of ['https://evil.example/', '//evil.example', '/entries?f=all&next=//evil', '/entries?f=other',
  '/tab/not-an-id', `/tab/${ID}/x`, '/worth', '/entries/abc', 'javascript:alert(1)', '', ' /entries', undefined, null, 42, {}])
  assert.equal(safeBack(to), '/entries', String(to));
ok('anything else — another site, a protocol-relative URL, an unknown chip, a bad id, a deeper path, a non-string — is /entries');

/* ── the trail ───────────────────────────────────────────────────────── */
const reset = () => store.clear();
const read = () => JSON.parse(store.get('ql.trail.v1') ?? '[]');

reset();
trail.visited('/');
assert.equal(trail.canGoBack(), false);
trail.visited('/entries');
assert.equal(trail.canGoBack(), true);
trail.visited('/');
assert.deepEqual(read(), ['/'], 'going to the address before the newest is a step back');
ok('a move forward pushes, a move to the address before pops; one address is nowhere to go back to');

reset();
for (const u of ['/', '/entries', '/entries?m=2026-10', '/entries?m=2026-09']) trail.visited(u);
assert.deepEqual(read(), ['/', '/entries', '/entries?m=2026-10', '/entries?m=2026-09'], 'month steps are kept');
trail.visited('/entries?m=2026-10');
assert.deepEqual(read(), ['/', '/entries', '/entries?m=2026-10'], 'Back from a month step pops to the month before');
ok('the month pill pushes on Activity: each month is a step, and Back walks them (the old rule swallowed them)');

reset();
for (const u of ['/', '/entries', '/entries?f=review', '/entries?f=sms']) trail.visited(u);
assert.deepEqual(read(), ['/', '/entries?f=sms'], 'chips replace');
ok('Activity\'s chips replace: three chips leave one step, so Back leaves Activity');

reset();
for (const u of ['/budget', '/entries?m=2026-10&c=abc', '/entries?m=2026-10']) trail.visited(u);
assert.deepEqual(read(), ['/budget', '/entries?m=2026-10'], 'leaving one category replaces');
for (const u of ['/entries?q=milk', '/entries']) trail.visited(u);
assert.deepEqual(read(), ['/budget', '/entries?m=2026-10', '/entries'], 'a search pushes; leaving it replaces');
ok('a search pushes; "Showing one category" and "Back to this month" replace');

assert.equal(trail.replacesOnActivity(undefined, '/entries?f=sms'), false);
assert.equal(trail.replacesOnActivity('/', '/entries?f=sms'), false);
assert.equal(trail.replacesOnActivity('/entries', '/entries?f=all'), false, 'no f is All');
assert.equal(trail.replacesOnActivity('/entries?f=sms', '/entries/abc'), false, 'opening an entry pushes');
ok('only /entries to /entries can replace, and All with or without ?f=all is the same view');

console.log(`  back.test: ${n} passed`);
