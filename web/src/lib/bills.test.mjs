// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { BILL_MAX_FILES, BILL_MAX_BYTES, BILL_MIME, billProblem, billFrom, billFromBase64 } = await import(`${process.env.LIB}/bills.js`);

assert.equal(BILL_MAX_FILES, 5);
assert.equal(BILL_MAX_BYTES, 2097152);
assert.deepEqual([...BILL_MIME].sort(), ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

// the ceilings, edge by edge
assert.equal(billProblem('image/jpeg', 1), null);
assert.equal(billProblem('application/pdf', BILL_MAX_BYTES), null);
assert.match(billProblem('image/jpeg', BILL_MAX_BYTES + 1), /2 MB/);
assert.match(billProblem('image/jpeg', 0), /empty/i);
for (const m of ['image/gif', 'text/html', 'image/svg+xml', '', 'IMAGE/JPEG', 'constructor', undefined, null, 5]) {
  assert.match(billProblem(m, 10), /images and PDFs/, String(m));
}

const jpg = Buffer.from([0xff, 0xd8, 0xff]);
assert.deepEqual(billFrom('slip.jpg', 'image/jpeg', jpg), { name: 'slip.jpg', mime: 'image/jpeg', buf: jpg });
assert.equal(billFrom('', 'image/jpeg', jpg).name, 'Bill');
assert.equal(billFrom('x'.repeat(300), 'image/jpeg', jpg).name.length, 120);
assert.equal(billFrom('a.gif', 'image/gif', jpg), null);
assert.equal(billFrom('a.jpg', 'image/jpeg', Buffer.alloc(0)), null);
assert.equal(billFrom('a.jpg', 'image/jpeg', Buffer.alloc(BILL_MAX_BYTES + 1)), null);

// the shape the phone sends: base64 in a plain object
const b = billFromBase64({ name: 'a.png', mime: 'image/png', data: jpg.toString('base64') });
assert.deepEqual(b.buf, jpg);
for (const bad of [null, undefined, 'x', 3, {}, { mime: 'image/png' }, { mime: 'image/png', data: 5 },
  { mime: 'text/html', data: 'AAAA' }, { mime: 'image/png', data: '' }]) {
  assert.equal(billFromBase64(bad), null, JSON.stringify(bad));
}
