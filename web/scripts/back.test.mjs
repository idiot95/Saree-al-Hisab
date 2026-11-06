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
assert.deepEqual(read(), ['/', '/worth', '/people', '/people/x'], 'nor to the next one');
trail.replacing('/'); go('/?saved=abc'); go('/');
assert.deepEqual(read(), ['/', '/worth', '/people', '/people/x', '/'], 'an address in between does not spend a mark');
go('/budget'); go('/');
assert.deepEqual(read(), ['/', '/worth', '/people', '/people/x', '/'], 'once used it is gone: Back to / pops as usual');
trail.replacing('/worth?o=a%20b'); go('/worth?o=a+b');
assert.equal(read().at(-1), '/worth?o=a+b');
assert.equal(read().length, 5, 'the same address spelled two ways is the same address');
ok('a mark applies only to the address it names, once, however the query is spelled, even with an address in between');

/* Every replacing navigation in the app is marked. The rules the scan enforces:
   - a <Link …> element whose props include `replace` also carries `data-replace` (the element is read to its real
     closing `>`, at brace depth 0 and outside quotes, so `=>` and `>` inside {…} do not end it);
   - each call of router.replace (whatever the router is called, or a `replace` destructured from useRouter()) and
     each history.replaceState is marked, call by call: `replacing(` within the six lines before it, or — the pairing
     rule — the call sits inside the props of a <Link … data-replace> (OwnerChips' onClick calls replaceState for its
     own Link, whose click NavTrail has already marked);
   - RedirectType.replace is refused outright: a server redirect cannot be marked on the phone.
   Comments are skipped: a comment may well describe a <Link replace>. */
{
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');

  /** Comment ranges, skipping quoted strings so 'image/*' or 'http://' never open one. */
  function commentRanges(src) {
    const out = [];
    let i = 0, q = null;
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === '\\') { i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; out.push([i, end]); i = end; continue; }
      if (c === '/' && src[i + 1] === '/' && src[i - 1] !== ':') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; out.push([i, end]); i = end; continue; }
      /* Quotes only open in code positions (after = ( , [ { : ? + ! & | or whitespace), not an apostrophe inside a word. */
      if ((c === '"' || c === "'" || c === '`') && /[=(,[{:?\s+!&|]/.test(src[i - 1] ?? ' ')) { q = c; i++; continue; }
      i++;
    }
    return out;
  }
  /** A JSX opening tag from `<Link` to its own closing `>`: depth 0, outside quotes. Returns [start, end, props]. */
  function linkElements(src) {
    const out = [];
    for (const m of src.matchAll(/<Link\b/g)) {
      let depth = 0, q = null, i = m.index + 5;
      for (; i < src.length; i++) {
        const c = src[i];
        if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
      }
      out.push([m.index, i, src.slice(m.index + 5, i)]);
    }
    return out;
  }
  /** The props written at depth 0 (outside any {…}): `replace`, `replace={x}`, `data-replace`. */
  const topLevel = (props) => { let d = 0, t = ''; for (const c of props) { if (c === '{') d++; if (d === 0) t += c; if (c === '}') d--; } return t; };

  const root = new URL('../src', import.meta.url).pathname;
  const files = readdirSync(root, { recursive: true }).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => join(root, f));
  const unmarked = [];
  let sites = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const comments = commentRanges(src);
    const inComment = (at) => comments.some(([a, b]) => at >= a && at < b);
    const links = linkElements(src).filter(([a]) => !inComment(a));
    for (const [, , props] of links) {
      const top = topLevel(props);
      if (!/(^|\s)replace(\s|=|\/|$)/.test(top)) continue;
      sites++;
      if (!/(^|\s)data-replace(\s|=|\/|$)/.test(top)) unmarked.push(`${f}: <Link replace> without data-replace`);
    }
    /* Every name a router is held by in this file, and a destructured replace. */
    const routers = new Set(['router']);
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*useRouter\(\)/g)) routers.add(m[1]);
    const calls = [];
    for (const r of routers) for (const m of src.matchAll(new RegExp(`\\b${r}\\.replace\\(`, 'g'))) calls.push([m.index, `${r}.replace(`]);
    for (const m of src.matchAll(/\bhistory\.replaceState\(/g)) calls.push([m.index, m[0]]);
    for (const m of src.matchAll(/const\s*\{[^}]*\breplace\b[^}]*\}\s*=\s*useRouter\(\)/g)) {
      if (!inComment(m.index)) unmarked.push(`${f}: replace destructured from useRouter() — call router.replace after replacing()`);
    }
    for (const m of src.matchAll(/\bRedirectType\.replace\b/g)) {
      if (!inComment(m.index)) unmarked.push(`${f}: RedirectType.replace cannot be marked for Back`);
    }
    for (const [at, what] of calls) {
      if (inComment(at)) continue;
      sites++;
      const lineStart = src.lastIndexOf('\n', at) + 1;
      let from = lineStart;
      for (let k = 0; k < 6 && from > 0; k++) from = src.lastIndexOf('\n', from - 2) + 1;
      const before = src.slice(from, at);
      const paired = links.some(([a, b, props]) => at > a && at < b && /(^|\s)data-replace(\s|=|\/|$)/.test(topLevel(props)));
      if (!/\breplacing\(/.test(before) && !paired) unmarked.push(`${f}:${src.slice(0, at).split('\n').length}: ${what} without replacing() just before it`);
    }
  }
  assert.deepEqual(unmarked, [], 'every replacing navigation is marked');
  assert.ok(sites >= 11, `the scan found the app's replacing navigations (${sites})`);
  ok(`all ${sites} replacing navigations in src are marked (data-replace, replacing() just before, or paired)`);

  /* The scan itself, on code written to slip past the old one. */
  const probe = (code) => {
    const comments = commentRanges(code);
    const links = linkElements(code).filter(([a]) => !comments.some(([x, y]) => a >= x && a < y));
    return links.map(([, , p]) => topLevel(p));
  };
  assert.deepEqual(probe(`<Link onClick={() => go(a > b)} replace href="/x">`).map((t) => /(^|\s)replace(\s|=|\/|$)/.test(t)), [true],
    'a `>` inside {…} does not end the element before `replace`');
  assert.deepEqual(probe(`/* <Link replace> */ const x = 'image/*'; <Link href="/y">`).length, 1, 'comments are skipped, quoted /* is not one');
  ok('the scan reads a <Link> to its real end and skips comments, not quoted /*');
}

console.log(`  back.test: ${n} passed`);
