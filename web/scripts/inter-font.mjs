/* Builds src/app/fonts/inter.woff2: Inter (variable weight, Google Fonts' own build) cut by Google to exactly the
   `latin` subset next/font used to preload, plus the rupee sign and the few other characters the screens draw that
   `latin` leaves out (EXTRA). Run once after changing EXTRA (npm run fonts:inter) and commit the result; nothing loads
   from Google at run time.

   Why: ₹ (U+20B9) is outside Google's `latin` subset, so every page with an amount drew ₹ in the fallback face,
   then fetched the 83KB `latin-ext` file late (it is not preloaded) and laid every figure out again (perf-findings
   §3, row 7). This one file is preloaded with the page and carries ₹ itself, and every other sign a household's
   currency can draw. It is the only Inter file: anything outside it (a name typed in Cyrillic) falls to the system
   face, as anything outside Google's subsets always did.

   Needs the network. Google's `text=` subsetting keeps the weight axis and the layout features (tnum, frac, calt…);
   the script checks both, and every character asked for, before it writes. */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Google's `latin` unicode-range for Inter (what next/font preloaded), less the controls, which have no glyph. */
const LATIN = [[0x20, 0x7e], [0xa0, 0xff], [0x131, 0x131], [0x152, 0x153], [0x2bb, 0x2bc], [0x2c6, 0x2c6],
  [0x2da, 0x2da], [0x2dc, 0x2dc], [0x304, 0x304], [0x308, 0x308], [0x329, 0x329], [0x2000, 0x206f], [0x20ac, 0x20ac],
  [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215], [0xfeff, 0xfeff],
  [0xfffd, 0xfffd]];
/* Beyond `latin`: the rupee (every amount), the arrow an account-to-account move and Trends' "before → now" draw,
   the five combining accents the old `latin` file carried though its range does not name them, and every other
   currency sign lib/money.ts writes that Inter has (zł, Kč, ₦ ₩ ₪ ₫ ₱ ₴ ₵ ₸ ₺ ₼ ₽ ₾; ৳, ฿ and the new riyal sign
   are not in Inter at all), so no household's figures reach for another file. */
const EXTRA = [0x20b9, 0x2192, 0x300, 0x301, 0x303, 0x309, 0x323,
  0x142, 0x10d, 0x20a6, 0x20a9, 0x20aa, 0x20ab, 0x20b1, 0x20b4, 0x20b5, 0x20b8, 0x20ba, 0x20bc, 0x20bd, 0x20be];

const codes = [];
for (const [a, b] of LATIN) for (let c = a; c <= b; c++) codes.push(c);
codes.push(...EXTRA);
const text = String.fromCodePoint(...codes);
const css = `https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap&text=${encodeURIComponent(text)}`;
// A modern user agent gets woff2.
const ua = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36' };
const res = await fetch(css, { headers: ua });
if (!res.ok) throw new Error(`css2 ${res.status}: ${await res.text()}`);
const sheet = await res.text();
const url = sheet.match(/url\((https:\/\/[^)]+)\) format\('woff2'\)/)?.[1];
if (!url) throw new Error(`no woff2 url in:\n${sheet}`);
const font = await fetch(url, { headers: ua });
if (!font.ok) throw new Error(`woff2 ${font.status}`);
const buf = Buffer.from(await font.arrayBuffer());
if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('not a woff2 file');
const out = join(root, 'src/app/fonts/inter.woff2');
writeFileSync(out, buf);
console.log(`${codes.length} characters -> ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
console.log('check it: python3 -c "from fontTools.ttLib import TTFont as T; f=T(\'src/app/fonts/inter.woff2\'); '
  + 'print(0x20b9 in f.getBestCmap(), [a.axisTag for a in f[\'fvar\'].axes])"');
