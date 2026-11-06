/* Builds src/app/fonts/material-symbols.woff2: Material Symbols Rounded,
   subset to the glyphs in src/app/icon-names.ts. Run once after changing that
   list (npm run icons:font) and commit the result; nothing loads from Google at
   run time. Needs the network, and node 22+ to read the .ts file.

   The names are read with a regex rather than imported, so this runs on any
   node. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/icon-names.ts'), 'utf8');
const table = src.slice(src.indexOf('ICON_NAMES'), src.indexOf('export const UI_NAMES'));
const ui = src.slice(src.indexOf('export const UI_NAMES'), src.indexOf('export const MATERIAL_USED'));
const names = new Set([
  ...Array.from(table.matchAll(/:\s*'([a-z0-9_]+)'/g), (m) => m[1]),
  ...Array.from(ui.matchAll(/'([a-z0-9_]+)'/g), (m) => m[1]),
]);
const list = [...names].sort().join(',');

const css = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..24,400,0..1,0&icon_names=${list}&display=block`;
// An old user agent would get ttf; a modern one gets woff2.
const res = await fetch(css, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' } });
if (!res.ok) throw new Error(`css2 ${res.status}: ${await res.text()}`);
const text = await res.text();
const url = text.match(/url\((https:\/\/[^)]+)\) format\('woff2'\)/)?.[1];
if (!url) throw new Error(`no woff2 url in:\n${text}`);
const font = await fetch(url);
if (!font.ok) throw new Error(`woff2 ${font.status}`);
const buf = Buffer.from(await font.arrayBuffer());
const out = join(root, 'src/app/fonts/material-symbols.woff2');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`${names.size} icons -> ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
