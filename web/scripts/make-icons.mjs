/* The app icon, drawn as raw pixels and written as a PNG by hand.

   No image library, because adding one to a finance app so it can draw three
   lines is a poor trade. The mark is the same one in the app header: a dark
   charcoal-blue tile with three cream rules, like a ledger page.

   Run: npm run icons                                                        */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const INK = [35, 61, 77];        // #233D4D, the header colour
const RULE = [242, 245, 240];    // #F2F5F0, the page colour
const ACCENT = [252, 202, 70];   // pollen, for the shortest rule

/** A rounded square on transparency, or a full bleed for maskable icons. */
function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : Math.round(size * 0.22);
  // Maskable icons are cropped to a circle by the launcher, so the mark has to
  // sit inside the middle 80% or Android will slice the ends off the rules.
  const inset = maskable ? size * 0.20 : size * 0.19;
  const usable = size - inset * 2;

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

  // Three rules, the middle one shorter, the last one accented — the same
  // shape as the mark used on the sign-in screen.
  const h = Math.max(2, Math.round(usable * 0.075));
  const gap = usable * 0.26;
  const top = inset + usable * 0.24;
  const rules = [
    { w: 1.0, colour: RULE },
    { w: 0.72, colour: RULE },
    { w: 0.44, colour: ACCENT },
  ];
  rules.forEach((rule, i) => {
    const y0 = Math.round(top + i * gap);
    const w = Math.round(usable * rule.w);
    const x0 = Math.round(inset);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, rule.colour);
      }
    }
  });
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
