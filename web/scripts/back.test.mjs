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

/* Replacing navigations are marked where they happen (replacing(), or data-replace on a <Link replace>), and the
   trail replaces its last step only for the address marked. */
const go = (u, replace = false) => { if (replace) trail.replacing(u); trail.visited(u); };

reset();
for (const u of ['/', '/entries', '/entries?m=2026-10', '/entries?m=2026-09']) go(u);
assert.deepEqual(read(), ['/', '/entries', '/entries?m=2026-10', '/entries?m=2026-09'], 'month steps are kept');
go('/entries?m=2026-10');
assert.deepEqual(read(), ['/', '/entries', '/entries?m=2026-10'], 'Back from a month step pops to the month before');
ok('the month pill pushes on Activity: each month is a step, and Back walks them');

reset();
go('/'); go('/entries'); go('/entries?f=review', true); go('/entries?f=sms', true);
assert.deepEqual(read(), ['/', '/entries?f=sms'], 'chips replace');
ok('Activity\'s chips replace: three chips leave one step, so Back leaves Activity');

reset();
go('/'); go('/entries?f=upcoming'); go('/entries?f=upcoming&new=1', true);
assert.deepEqual(read(), ['/', '/entries?f=upcoming&new=1'], 'Upcoming\'s "Add a regular payment" replaces');
ok('Upcoming\'s empty-state "Add a regular payment" (a Link replace adding &new=1) replaces, not pushes');

reset();
go('/'); go('/entries?f=sms&dismissed=abc'); go('/entries?f=sms', true);
assert.deepEqual(read(), ['/', '/entries?f=sms'], 'dropping ?dismissed= replaces');
ok('From SMS dropping ?dismissed= (router.replace) replaces, not pushes');

reset();
go('/budget'); go('/entries?m=2026-10&c=abc'); go('/entries?m=2026-10', true);
go('/entries?q=milk'); go('/entries', true);
assert.deepEqual(read(), ['/budget', '/entries?m=2026-10', '/entries'], 'a search pushes; leaving it replaces');
ok('a search pushes; "Showing one category" and "Back to this month" replace');

reset();
go('/'); go('/worth');
trail.replacing('/worth?o=joint'); go('/people');
assert.deepEqual(read(), ['/', '/worth', '/people'], 'a mark for another address does not apply');
go('/people/x');
assert.deepEqual(read(), ['/', '/worth', '/people', '/people/x'], 'and it is spent: the next move pushes');
trail.replacing('/worth?o=a%20b'); go('/worth?o=a+b');
assert.equal(read().at(-1), '/worth?o=a+b');
assert.equal(read().length, 4, 'the same address spelled two ways is the same address');
ok('a mark applies only to the address it names, once, however the query is spelled');

/* Every replacing navigation in the app is marked: a <Link replace> carries data-replace, and a file that calls
   router.replace or history.replaceState calls replacing() (or marks the Link it belongs to). */
{
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../src', import.meta.url).pathname;
  const files = readdirSync(root, { recursive: true }).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => join(root, f));
  const unmarked = [];
  let sites = 0;
  for (const f of files) {
    // Code only: a comment may well describe a <Link replace>.
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(/<Link\b([\s\S]*?)>/g)) {
      if (!/(^|\s)replace(\s|=|\/|$)/.test(m[1])) continue;
      sites++;
      if (!/data-replace/.test(m[1])) unmarked.push(`${f}: <Link replace> without data-replace`);
    }
    for (const m of src.matchAll(/\b(?:router\.replace|history\.replaceState)\(/g)) {
      sites++;
      if (!/\breplacing\(|data-replace/.test(src)) unmarked.push(`${f}: ${m[0]} without replacing()`);
    }
  }
  assert.deepEqual(unmarked, [], 'every replacing navigation is marked');
  assert.ok(sites >= 11, `the scan found the app's replacing navigations (${sites})`);
  ok(`all ${sites} replacing navigations in src are marked (data-replace or replacing())`);
}

console.log(`  back.test: ${n} passed`);
