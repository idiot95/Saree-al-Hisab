/* The app icon, drawn as raw pixels and written as a PNG by hand.

   No image library, because adding one to a finance app so it can draw a
   letter is a poor trade. The mark is ح — the first letter of حساب, the
   reckoning the app is named for — in cream on the header's charcoal blue.

   The outline below was traced once from Noto Naskh Arabic Bold (SIL OFL
   1.1) and is stored as a polygon in a 0..1 box, so this script needs no
   font at run time and draws the same letter every time. Bold rather than
   regular: at 44 pixels the thin joint between the blade and the bowl in the
   regular weight closes up and the letter turns into a smudge.

   Run: npm run icons                                                        */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const INK = [35, 61, 77];        // #233D4D, the header colour
const CREAM = [242, 245, 240];   // #F2F5F0, the page colour

/** Width ÷ height of the letter's ink, so it is never stretched. */
const RATIO = 0.8054;
/** The outline, anticlockwise, as x,y pairs in a 0..1 box. */
const HAA = [
  0.2188,0.0000, 0.2938,0.0024, 0.3665,0.0125, 0.4481,0.0311, 0.6135,0.0771, 0.6728,0.0902,
  0.7188,0.0980, 0.8019,0.1057, 0.9926,0.1039, 0.9199,0.2634, 0.8598,0.2676, 0.8034,0.2688,
  0.7010,0.2664, 0.6595,0.2730, 0.6135,0.2832, 0.5757,0.2933, 0.5089,0.3148, 0.4236,0.3489,
  0.3509,0.3859, 0.3205,0.4044, 0.2804,0.4325, 0.2352,0.4713, 0.1996,0.5113, 0.1758,0.5490,
  0.1617,0.5848, 0.1558,0.6278, 0.1602,0.6661, 0.1736,0.6995, 0.1944,0.7282, 0.2070,0.7407,
  0.2344,0.7622, 0.2589,0.7772, 0.2886,0.7915, 0.3450,0.8112, 0.4169,0.8268, 0.4666,0.8327,
  0.5185,0.8357, 0.5846,0.8357, 0.6625,0.8321, 0.8094,0.8178, 0.9755,0.7915, 1.0000,0.8512,
  0.8702,0.9068, 0.7441,0.9534, 0.6877,0.9713, 0.6328,0.9863, 0.5913,0.9952, 0.5542,1.0000,
  0.4970,0.9994, 0.4310,0.9940, 0.3642,0.9827, 0.3116,0.9683, 0.2582,0.9474, 0.2181,0.9259,
  0.1921,0.9086, 0.1691,0.8901, 0.1461,0.8680, 0.1157,0.8297, 0.0972,0.7975, 0.0779,0.7461,
  0.0690,0.7013, 0.0660,0.6655, 0.0690,0.6028, 0.0794,0.5544, 0.0987,0.5030, 0.1172,0.4677,
  0.1491,0.4212, 0.1825,0.3829, 0.2196,0.3483, 0.2745,0.3065, 0.3242,0.2742, 0.3828,0.2419,
  0.4444,0.2150, 0.3724,0.1923, 0.3101,0.1774, 0.2537,0.1703, 0.2114,0.1703, 0.1736,0.1744,
  0.1454,0.1810, 0.0987,0.1983, 0.0415,0.2258, 0.0364,0.2222, 0.0223,0.2055, 0.0111,0.1858,
  0.0044,0.1691, 0.0000,0.1464, 0.0037,0.1099, 0.0126,0.0878, 0.0230,0.0723, 0.0356,0.0585,
  0.0564,0.0424, 0.0809,0.0287, 0.1009,0.0203, 0.1350,0.0102, 0.1595,0.0054, 0.2188,0.0000
];

/* Fill the closed outline into the buffer. Scanlines with four subsamples per
   row and exact horizontal coverage per span: enough antialiasing that the
   curve reads as a curve at 44 pixels, and cheap enough to be instant.

   Nonzero winding, not even-odd. The outline is a boundary walk of the
   glyph's pixels, and where a stroke tapers to a point the walk goes out and
   back along the same few pixels. Even-odd reads those spurs as holes and
   punches notches out of the letter's terminals — which is exactly what it
   did, until it didn't. */
function fillGlyph(px, size, box, colour) {
  const SS = 4;
  const n = HAA.length / 2;
  const gx = (i) => box.x + HAA[i * 2] * box.w;
  const gy = (i) => box.y + HAA[i * 2 + 1] * box.h;
  const cov = new Float32Array(size * size);
  const hits = [];

  for (let sy = 0; sy < size * SS; sy++) {
    const yy = (sy + 0.5) / SS;
    const row = Math.floor(yy);
    if (row < 0 || row >= size) continue;
    hits.length = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const y1 = gy(i), y2 = gy(j);
      let dir = 0;
      if (y1 <= yy && y2 > yy) dir = 1;
      else if (y2 <= yy && y1 > yy) dir = -1;
      if (dir) hits.push({ x: gx(i) + ((yy - y1) / (y2 - y1)) * (gx(j) - gx(i)), dir });
    }
    hits.sort((a, b) => a.x - b.x);

    let wind = 0, start = 0;
    for (const h of hits) {
      const was = wind;
      wind += h.dir;
      if (was === 0 && wind !== 0) { start = h.x; continue; }
      if (was !== 0 && wind === 0) {
        const a = start, b = h.x;
        const from = Math.max(0, Math.floor(a));
        const to = Math.min(size - 1, Math.ceil(b) - 1);
        for (let x = from; x <= to; x++) {
          const l = Math.max(a, x), r = Math.min(b, x + 1);
          if (r > l) cov[row * size + x] += (r - l) / SS;
        }
      }
    }
  }

  for (let i = 0; i < size * size; i++) {
    const a = Math.min(1, cov[i]);
    if (a <= 0) continue;
    const p = i * 4;
    for (let c = 0; c < 3; c++) px[p + c] = Math.round(px[p + c] * (1 - a) + colour[c] * a);
    px[p + 3] = Math.max(px[p + 3], Math.round(255 * a));
  }
}

/** A rounded square on transparency, or a full bleed for maskable icons. */
function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : Math.round(size * 0.224);

  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (maskable) { set(x, y, INK); continue; }
      // Rounded corners, with a little coverage-based smoothing at the edge.
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const d = Math.hypot(dx, dy);
      if (d <= radius - 0.5) set(x, y, INK);
      else if (d < radius + 0.5) set(x, y, INK, Math.round(255 * (radius + 0.5 - d)));
    }
  }

  /* Maskable icons are cropped to a circle by the launcher, so the letter is
     drawn smaller there — its corners have to stay inside the middle 80% or
     Android slices the tail off. */
  const h = size * (maskable ? 0.56 : 0.60);
  const w = h * RATIO;
  fillGlyph(px, size, { x: (size - w) / 2, y: (size - h) / 2, w, h }, CREAM);
  return px;
}

function png(size, px) {
  // Each scanline is prefixed with its filter type; 0 means "none".
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

for (const [name, size, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }], // iOS squares it anyway
]) {
  const file = join(OUT, name);
  writeFileSync(file, png(size, draw(size, opts)));
  console.log(`  ${name.padEnd(22)} ${size}×${size}`);
}
