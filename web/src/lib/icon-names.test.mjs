/* Every icon name a household can have stored maps to a Material Symbols name,
   because categories keep the app name in the database and the picker offers
   them. Reads the sources as text, like taxonomy.test.mjs. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(`${here}/../app/${p}`, 'utf8');
const quoted = (s) => Array.from(s.matchAll(/'([a-z0-9]+)'/g), (m) => m[1]);

const table = src('icon-names.ts');
const body = table.slice(table.indexOf('ICON_NAMES'), table.indexOf('export const UI_NAMES'));
const map = new Map(Array.from(body.matchAll(/\b([a-z0-9]+):\s*'([^']+)'/g), (m) => [m[1], m[2]]));
assert.ok(map.get('cart') === 'shopping_cart' && map.get('cutlery') === 'restaurant' && map.get('fuel') === 'local_gas_station');

// The names the app had before Material Symbols: Icon.tsx's SET.
const FORMER_SET = [
  'house2', 'cart', 'child', 'cutlery', 'bag', 'bulb', 'car', 'health', 'phone', 'gift', 'plane',
  'fuel', 'book', 'coffee', 'scissors', 'tools', 'pet', 'gym', 'music', 'wifi', 'shield', 'charity',
  'salary', 'invest', 'tag', 'bank', 'cash', 'savings', 'card', 'person', 'upi', 'netbanking',
  'cheque', 'wallet', 'autodebit', 'settings', 'sun', 'moon', 'worth', 'receivable', 'tab', 'plus',
  'camera', 'upload', 'pencil', 'check', 'trash', 'skip', 'stop', 'move', 'folder', 'dots', 'bell',
  'clip', 'google', 'linked', 'unlinked',
];
const more = quoted(src('glyph-names.ts'));
const picker = quoted(src('categories/options.ts').split('export const ICONS')[1].split('...MORE_GLYPHS')[0]);
assert.ok(more.length > 150 && picker.length >= 29, 'the name lists were read');

for (const n of [...FORMER_SET, ...more, ...picker]) assert.ok(map.has(n), `"${n}" has a Material name`);
for (const [k, v] of map) assert.match(v, /^[a-z0-9_]+$/, `${k} -> ${v} is a ligature name`);
// What the account kinds and payment rails draw (ACCOUNT_ICON, RAIL_ICON in Icon.tsx).
for (const n of ['bank', 'cash', 'savings', 'card', 'person', 'upi', 'netbanking', 'cheque', 'wallet', 'autodebit']) {
  assert.ok(map.has(n), `"${n}" has a Material name`);
}
console.log('  icon-names: ok');
