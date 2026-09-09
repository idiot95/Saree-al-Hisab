/* The app icon, drawn as raw pixels and written as a PNG by hand.

   No image library, because adding one to a finance app so it can draw a
   letter is a poor trade. The mark is ح — the first letter of حساب, the
   reckoning the app is named for — in cream on the header's charcoal blue.

   The outline below is Amiri's ح (SIL OFL 1.1), the same face the app sets
   إن الله سريع الحساب in, so the mark on the home screen and the line in the
   header are one hand rather than two. It was extracted once from the font's
   own contours — flattened from quadratics to 164 points in a 0..1 box — so
   this script needs no font at run time and draws the same letter every time.

   It replaced a traced Noto Naskh Bold outline. Amiri is a naskh drawn for
   setting the Qur'an: the joint between the blade and the bowl is confident
   enough to survive 44 pixels, which was the reason the Noto tracing had to
   be the bold weight.

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
const RATIO = 0.8970;
/** The outline, anticlockwise, as x,y pairs in a 0..1 box. */
const HAA = [
  0.8212,0.0429, 0.7866,0.1127, 0.7846,0.1159, 0.7823,0.1186, 0.7798,0.1208, 0.7770,0.1225,
  0.7740,0.1237, 0.7707,0.1243, 0.6612,0.1389, 0.5633,0.1557, 0.4770,0.1748, 0.4023,0.1962,
  0.3392,0.2199, 0.2877,0.2459, 0.2069,0.3008, 0.1443,0.3593, 0.0999,0.4215, 0.0737,0.4874,
  0.0656,0.5569, 0.0758,0.6301, 0.0908,0.6699, 0.1136,0.7068, 0.1443,0.7406, 0.1828,0.7715,
  0.2292,0.7993, 0.2834,0.8241, 0.3186,0.8358, 0.3598,0.8462, 0.4070,0.8551, 0.4603,0.8626,
  0.5195,0.8686, 0.5847,0.8732, 0.6187,0.8748, 0.6524,0.8759, 0.6857,0.8768, 0.7187,0.8772,
  0.7514,0.8773, 0.7837,0.8771, 0.8157,0.8765, 0.8472,0.8757, 0.8782,0.8745, 0.9087,0.8731,
  0.9387,0.8713, 0.9683,0.8693, 0.9755,0.8688, 0.9817,0.8688, 0.9870,0.8693, 0.9913,0.8705,
  0.9947,0.8722, 0.9971,0.8745, 0.9987,0.8771, 0.9997,0.8798, 1.0000,0.8826, 0.9997,0.8854,
  0.9987,0.8883, 0.9971,0.8913, 0.9961,0.8930, 0.9950,0.8944, 0.9937,0.8957, 0.9923,0.8968,
  0.9908,0.8977, 0.9892,0.8984, 0.9875,0.8991, 0.9857,0.8998, 0.9840,0.9005, 0.9821,0.9013,
  0.9803,0.9021, 0.9784,0.9030, 0.9501,0.9108, 0.9241,0.9189, 0.9002,0.9272, 0.8784,0.9357,
  0.8588,0.9445, 0.8414,0.9534, 0.8297,0.9600, 0.8187,0.9659, 0.8084,0.9712, 0.7988,0.9758,
  0.7898,0.9798, 0.7816,0.9832, 0.7741,0.9860, 0.7674,0.9883, 0.7616,0.9903, 0.7566,0.9918,
  0.7524,0.9929, 0.7491,0.9935, 0.6144,1.0000, 0.4928,0.9980, 0.3843,0.9874, 0.2890,0.9682,
  0.2068,0.9405, 0.1378,0.9043, 0.0819,0.8594, 0.0404,0.8068, 0.0131,0.7465, 0.0000,0.6783,
  0.0012,0.6025, 0.0167,0.5188, 0.0452,0.4345, 0.0855,0.3583, 0.1378,0.2902, 0.2019,0.2303,
  0.2778,0.1784, 0.3656,0.1347, 0.3042,0.1231, 0.2480,0.1167, 0.1969,0.1156, 0.1509,0.1197,
  0.1101,0.1291, 0.0743,0.1437, 0.0711,0.1449, 0.0679,0.1458, 0.0650,0.1463, 0.0622,0.1466,
  0.0595,0.1466, 0.0570,0.1463, 0.0548,0.1457, 0.0530,0.1448, 0.0516,0.1434, 0.0506,0.1417,
  0.0500,0.1397, 0.0498,0.1373, 0.0510,0.1265, 0.0527,0.1159, 0.0549,0.1053, 0.0575,0.0947,
  0.0606,0.0843, 0.0642,0.0739, 0.0753,0.0528, 0.0912,0.0352, 0.1118,0.0212, 0.1373,0.0107,
  0.1676,0.0037, 0.2027,0.0002, 0.2232,0.0000, 0.2474,0.0012, 0.2751,0.0037, 0.3065,0.0077,
  0.3414,0.0129, 0.3800,0.0196, 0.4194,0.0262, 0.4567,0.0315, 0.4921,0.0354, 0.5255,0.0380,
  0.5568,0.0392, 0.5862,0.0390, 0.6004,0.0385, 0.6152,0.0378, 0.6305,0.0369, 0.6464,0.0358,
  0.6629,0.0346, 0.6799,0.0332, 0.6975,0.0315, 0.7156,0.0296, 0.7343,0.0275, 0.7536,0.0251,
  0.7734,0.0225, 0.7938,0.0196, 0.8062,0.0188, 0.8154,0.0199, 0.8216,0.0228, 0.8246,0.0276,
  0.8245,0.0343, 0.8212,0.0429
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
