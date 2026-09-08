import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { LIBRARY, suggestedGroup, alreadyHave } = await import(`${process.env.LIB}/taxonomy.js`);

/* The icons a category may wear are declared in two places in the app, and
   the library must only use those: a name the picker cannot draw would show
   as a blank tile. Read straight from the source files rather than importing
   them, because the app's modules pull in React. */
const here = new URL('.', import.meta.url).pathname;
const src = (p) => readFileSync(`${here}/../app/${p}`, 'utf8');
const quoted = (s) => Array.from(s.matchAll(/'([a-z0-9]+)'/g), (m) => m[1]);
const icons = new Set([
  ...quoted(src('glyph-names.ts')),
  ...quoted(src('categories/options.ts').split('...MORE_GLYPHS')[0]),
]);
assert.ok(icons.has('cart') && icons.has('milk'), 'the icon lists were read');
const tints = new Set(quoted(src('categories/options.ts').split('export const ICONS')[0]));
assert.ok(tints.has('green') && tints.size >= 8, 'the tint list was read');

const seen = new Map();
let children = 0;
for (const grp of LIBRARY) {
  assert.ok(icons.has(grp.icon), `${grp.name}: icon "${grp.icon}" exists`);
  assert.ok(tints.has(grp.tint), `${grp.name}: tint "${grp.tint}" exists`);
  assert.ok(grp.scope === 'expense' || grp.scope === 'income', `${grp.name}: has a scope`);
  assert.ok(grp.name.length >= 2 && grp.name.length <= 40, `${grp.name}: a name the form would accept`);
  assert.ok(grp.children.length >= 2, `${grp.name}: is a group, with children`);
  const k = grp.name.toLowerCase();
  assert.ok(!seen.has(k), `"${grp.name}" is named once (also as ${seen.get(k)})`);
  seen.set(k, `parent`);
  for (const c of grp.children) {
    children++;
    assert.ok(icons.has(c.icon), `${grp.name} › ${c.name}: icon "${c.icon}" exists`);
    assert.ok(c.name.length >= 2 && c.name.length <= 40, `${c.name}: a name the form would accept`);
    const ck = c.name.toLowerCase();
    assert.ok(!seen.has(ck), `"${c.name}" is named once (also as ${seen.get(ck)})`);
    seen.set(ck, `child of ${grp.name}`);
  }
}
assert.ok(LIBRARY.length >= 25, 'a long list: at least twenty-five groups');
assert.ok(children >= 120, 'with well over a hundred children');
assert.ok(LIBRARY.some((s) => s.scope === 'income'), 'income has groups too');

assert.equal(suggestedGroup('groceries')?.name, 'Groceries', 'a group by name, any case');
assert.equal(suggestedGroup('nothing'), undefined);
const have = alreadyHave(suggestedGroup('Groceries'), ['groceries', 'Milk & dairy', 'Rent']);
assert.deepEqual(have, { parent: true, children: 1 });

console.log(`taxonomy: ${LIBRARY.length} groups, ${children} children, every icon drawable`);
