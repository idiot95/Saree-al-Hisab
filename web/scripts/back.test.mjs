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

/* A mark nobody spent does not wait for a later push to the same address: the next link the person taps drops it.
   A mark for "/" is pending, the person taps Budget, then Home, within the ten seconds: both are pushes. */
reset();
go('/'); go('/entries');
trail.replacing('/');
trail.tapped('/budget', false, '/entries'); go('/budget');
trail.tapped('/', false, '/budget'); go('/');
assert.deepEqual(read(), ['/', '/entries', '/budget', '/'], 'Budget then Home are pushes, not a replace');
/* A tap on a data-replace link marks its own address; a tap on a link to where the page already is changes nothing. */
reset();
go('/'); go('/entries');
trail.tapped('/entries?f=sms', true, '/entries'); go('/entries?f=sms');
assert.deepEqual(read(), ['/', '/entries?f=sms'], 'a data-replace tap marks its address');
trail.replacing('/x'); trail.tapped('/entries?f=sms', false, 'http://h/entries?f=sms');
trail.visited('/x');
assert.deepEqual(read(), ['/', '/x'], 'a tap on the current address left the pending mark alone');
ok('a link tap drops a mark nobody spent (Budget then Home push); a data-replace tap marks its own; a tap on the current address changes nothing');

/* Every replacing navigation in the app is marked. The rules the scan enforces, on the code with its comments
   blanked out (a comment may well describe a <Link replace>, or say "replacing("):
   - a <Link …> element whose props include `replace` also carries `data-replace` (the element is read to its real
     closing `>`, at brace depth 0 and outside quotes, so `=>` and `>` inside {…} do not end it);
   - each call of `<router>.replace(` / `<router>?.replace(` and `history.replaceState(` is marked, call by call. A
     router is `router`, any name given a useRouter() result (const, let or var), and any identifier named or typed
     as a router (a parameter `router`, `nav: AppRouterInstance`, `r: ReturnType<typeof useRouter>`). Marked means
     a `replacing(` in the six lines before the call that either names the same target (the same argument text)
     or comes immediately before it, with nothing but `;`, whitespace, an `await` and the call's member chain
     (`props.router`) between. Arguments are read with string and template literals skipped, so a `)` or `,` in a
     path is not code. Each `replacing(` marks one call only (a call takes the nearest unspent one before it).
     The pairing rule: a call inside
     the props of a <Link … data-replace> is marked by that Link (OwnerChips' onClick replaces for its own Link,
     whose tap NavTrail has already marked);
   - a `replace` destructured from useRouter(), and RedirectType.replace, are refused outright: the first escapes the
     per-call check, and a server redirect cannot be marked on the phone. */
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
  /** The source with every comment blanked to spaces (newlines kept), so offsets and line numbers still hold. */
  const blank = (src) => {
    let out = '', at = 0;
    for (const [a, b] of commentRanges(src)) { out += src.slice(at, a) + src.slice(a, b).replace(/[^\n]/g, ' '); at = b; }
    return out + src.slice(at);
  };
  /** A JSX opening tag from `<Link` to its own closing `>`: depth 0, outside quotes. Returns [start, end, props]. */
  function linkElements(code) {
    const out = [];
    for (const m of code.matchAll(/<Link\b/g)) {
      let depth = 0, q = null, i = m.index + 5;
      for (; i < code.length; i++) {
        const c = code[i];
        if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
      }
      out.push([m.index, i, code.slice(m.index + 5, i)]);
    }
    return out;
  }
  /** The props written at depth 0 (outside any {…}): `replace`, `replace={x}`, `data-replace`. */
  const topLevel = (props) => { let d = 0, t = ''; for (const c of props) { if (c === '{') d++; if (d === 0) t += c; if (c === '}') d--; } return t; };
  const has = (props, name) => new RegExp(`(^|\\s)${name}(\\s|=|\\/|$)`).test(topLevel(props));
  /** The index of the quote closing the string or template literal opened at `i`. A template's `${…}` is walked as
   *  code (braces counted, strings inside it skipped in turn), so a `)`, `,` or quote in any of them is not code. */
  function skipString(code, i) {
    const q = code[i];
    for (let j = i + 1; j < code.length; j++) {
      const c = code[j];
      if (c === '\\') { j++; continue; }
      if (c === q) return j;
      if (q === '`' && c === '$' && code[j + 1] === '{') {
        let d = 0;
        for (j += 1; j < code.length; j++) {
          const e = code[j];
          if (e === '"' || e === "'" || e === '`') j = skipString(code, j);
          else if (e === '{') d++;
          else if (e === '}' && --d === 0) break;
        }
      }
    }
    return code.length;
  }
  const isQuote = (c) => c === '"' || c === "'" || c === '`';
  /** The argument text of the call whose `(` is at `open`, and the index just after its `)`. Strings are skipped. */
  const argsAt = (code, open) => {
    let d = 0, i = open;
    for (; i < code.length; i++) {
      const c = code[i];
      if (isQuote(c)) i = skipString(code, i);
      else if (c === '(') d++;
      else if (c === ')' && --d === 0) break;
    }
    return [code.slice(open + 1, i), i + 1];
  };
  /** The top-level arguments of an argument text, split at depth-0 commas outside strings. */
  const argList = (args) => {
    const out = [];
    let d = 0, from = 0;
    for (let i = 0; i < args.length; i++) {
      const c = args[i];
      if (isQuote(c)) i = skipString(args, i);
      else if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) d--;
      else if (c === ',' && d === 0) { out.push(args.slice(from, i).trim()); from = i + 1; }
    }
    out.push(args.slice(from).trim());
    return out;
  };
  const firstArg = (args) => argList(args)[0];
  /** What may sit between a `replacing(…)` and the call it marks for "immediately before": `;`, whitespace, an
   *  `await`, and the member chain leading to the router (`props.router`, `this.props?.router`). */
  const JUST_BEFORE = /^[\s;]*(?:await\s+)?(?:[\w$]+\s*\??\.\s*)*$/;

  /** Every finding for one file's source. */
  function scan(src, f = 'probe') {
    const code = blank(src);
    const found = [];
    let sites = 0;
    const links = linkElements(code);
    for (const [, , props] of links) {
      if (!has(props, 'replace')) continue;
      sites++;
      if (!has(props, 'data-replace')) found.push(`${f}: <Link replace> without data-replace`);
    }
    const routers = new Set(['router']);
    for (const m of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*useRouter\(\)/g)) routers.add(m[1]);
    for (const m of code.matchAll(/\b(\w+)\s*\??:\s*(?:AppRouterInstance|ReturnType<\s*typeof\s+useRouter\s*>)/g)) routers.add(m[1]);
    for (const m of code.matchAll(/\b(\w*[Rr]outer\w*)\b/g)) if (!/^use/.test(m[1]) && m[1] !== 'AppRouterInstance') routers.add(m[1]);
    for (const m of code.matchAll(/\b(?:const|let|var)\s*\{[^}]*\breplace\b[^}]*\}\s*=\s*(?:useRouter\(\)|\w+)/g)) {
      const rhs = m[0].split('=').pop().trim();
      if (rhs === 'useRouter()' || routers.has(rhs)) found.push(`${f}: replace destructured from a router — call <router>.replace after replacing()`);
    }
    for (const m of code.matchAll(/\bRedirectType\.replace\b/g)) { void m; found.push(`${f}: RedirectType.replace cannot be marked for Back`); }
    const calls = [];
    for (const r of routers) for (const m of code.matchAll(new RegExp(`\\b${r}\\s*\\??\\.\\s*replace\\s*\\(`, 'g'))) calls.push([m.index, m.index + m[0].length - 1, `${r}.replace(`]);
    for (const m of code.matchAll(/\bhistory\s*\.\s*replaceState\s*\(/g)) calls.push([m.index, m.index + m[0].length - 1, 'history.replaceState(']);
    /* In source order, and each replacing( marks one call only: a mark spent on one call is not there for the next. */
    calls.sort((a, b) => a[0] - b[0]);
    const spent = new Set();
    for (const [at, open, what] of calls) {
      sites++;
      const line = code.slice(0, at).split('\n').length;
      if (links.some(([a, b, props]) => at > a && at < b && has(props, 'data-replace'))) continue;
      let from = code.lastIndexOf('\n', at) + 1;
      for (let k = 0; k < 6 && from > 0; k++) from = code.lastIndexOf('\n', from - 2) + 1;
      const window = code.slice(from, at);
      const marks = [...window.matchAll(/\breplacing\s*\(/g)].filter((mk) => !spent.has(from + mk.index)).reverse();
      const args = argList(argsAt(code, open)[0]);
      const target = what === 'history.replaceState(' ? (args[2] ?? '') : args[0];
      const mark = marks.find((mk) => {
        const [margs, end] = argsAt(window, mk.index + mk[0].length - 1);
        return firstArg(margs) === target || JUST_BEFORE.test(window.slice(end));
      });
      if (mark) spent.add(from + mark.index);
      else found.push(`${f}:${line}: ${what} without replacing() for it just before`);
    }
    return { found, sites };
  }

  const root = new URL('../src', import.meta.url).pathname;
  const files = readdirSync(root, { recursive: true }).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => join(root, f));
  const unmarked = [];
  let sites = 0;
  for (const f of files) { const r = scan(readFileSync(f, 'utf8'), f); unmarked.push(...r.found); sites += r.sites; }
  assert.deepEqual(unmarked, [], 'every replacing navigation is marked');
  assert.ok(sites >= 11, `the scan found the app's replacing navigations (${sites})`);
  ok(`all ${sites} replacing navigations in src are marked (data-replace, replacing() for that call, or paired)`);

  /* The scan itself, on code written to slip past a looser one. Each must be caught, or (the last three) pass. */
  const caught = (code) => scan(code).found.length > 0;
  assert.ok(caught(`<Link onClick={() => go(a > b)} replace href="/x">`), 'a `>` inside {…} does not end the element before `replace`');
  {
    /* The commented Link must not count, and the quoted /* must not open a comment that would hide the real one. */
    const r = scan(`/* <Link replace> */ const x = 'image/*'; <Link replace href="/y">`);
    assert.deepEqual(r.found, ['probe: <Link replace> without data-replace'], 'comments are skipped, a quoted /* is not one: the trailing Link replace is caught, once');
  }
  assert.ok(caught(`// replacing('/a')\nrouter.replace('/a');`), 'a replacing( inside a comment does not count');
  assert.ok(caught(`replacing('/a');\nrouter.push('/b');\nrouter.replace('/c');`), 'a replacing( for another target, before another call, does not count');
  assert.ok(caught(`let nav = useRouter();\nnav.replace('/a');`), 'a let alias of useRouter is a router');
  assert.ok(caught(`var go = useRouter();\ngo.replace('/a');`), 'a var alias of useRouter is a router');
  assert.ok(caught(`function f(r: AppRouterInstance) { r.replace('/a'); }`), 'a parameter typed as a router is a router');
  assert.ok(caught(`function f(appRouter) { appRouter.replace('/a'); }`), 'a parameter named as a router is a router');
  assert.ok(caught(`router?.replace('/a');`), 'router?.replace( is a call');
  assert.ok(caught(`const { replace } = useRouter();`), 'a replace destructured from useRouter is refused');
  assert.ok(caught(`redirect('/a', RedirectType.replace);`), 'RedirectType.replace is refused');
  assert.ok(!caught(`replacing(\`/tab/\${id}\`);\nrouter.replace(\`/tab/\${id}\`, { scroll: false });`), 'the same target, just before, passes');
  assert.ok(!caught(`replacing(url);\nrouter.replace(next);`), 'immediately before passes');
  assert.ok(!caught(`const s = text.replace(/a/g, 'b');`), 'a string .replace is not a router');
  assert.ok(!caught(`replacing('/a(');\nrouter.push('/x');\nrouter.replace('/a(');`), 'a ( inside a string does not throw the argument reading off');
  assert.ok(!caught(`replacing(\`/a)\${id}\`);\nrouter.push('/x');\nrouter.replace(\`/a)\${id}\`);`), 'a ) inside a template literal does not either');
  assert.ok(caught(`replacing(')' + x);\nrouter.push('/x');\nrouter.replace(')' + y);`), 'a ) inside a string does not end the arguments early (the targets differ)');
  assert.ok(caught(`replacing(\`)\${x}\`);\nrouter.push('/x');\nrouter.replace(\`)\${y}\`);`), 'nor a ) inside a template literal');
  assert.ok(caught(`replacing('/a,b');\nrouter.push('/x');\nrouter.replace('/a,c');`), 'a comma inside a string is not an argument break (the targets differ)');
  assert.ok(caught(`replacing(\`/a,\${x}\`);\nrouter.push('/x');\nrouter.replace(\`/a,\${y}\`);`), 'nor a comma inside a template literal');
  assert.ok(caught(`history.replaceState(null, '', 'a,b');`), 'replaceState with no mark is caught (its url read past a quoted comma)');
  assert.ok(!caught(`replacing('a,b');\nhistory.replaceState(null, '', 'a,b');`), 'and its own mark, naming the url with a comma, passes');
  assert.ok(caught(`replacing('/a');\nrouter.replace('/a');\nrouter.replace('/a');`), 'one replacing( marks one call, not two');
  assert.ok(caught(`replacing(url);\nrouter.replace(a);\nrouter.replace(b);`), 'nor two by being immediately before the first');
  assert.ok(!caught(`replacing('/a');\nrouter.replace('/a');\nreplacing('/a');\nrouter.replace('/a');`), 'two marks for two calls pass');
  assert.ok(!caught(`replacing(url);\nawait router.replace(next);`), 'immediately before an await call passes');
  assert.ok(!caught(`replacing(url);\nprops.router.replace(next);`), 'immediately before a member chain passes');
  assert.ok(!caught(`replacing(url);\nawait this.props?.router?.replace(next);`), 'and before an await on a longer, optional chain');
  assert.ok(caught(`replacing(url);\nfoo(); props.router.replace(next);`), 'but not with another statement between');
  ok('the scan catches commented marks, marks for another call, a mark used twice, quoted ( ) and commas, let/var/parameter/typed routers, ?. calls, destructured replace and RedirectType.replace; passes the right shapes');
}

console.log(`  back.test: ${n} passed`);
