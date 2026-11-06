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

// serving: ids, names, headers
const { isUuid, safeName, dispositionFor, SERVE_HEADERS } = await import(`${process.env.LIB}/bills.js`);
assert.equal(isUuid('c5a698e7-c758-40e4-a73f-b7228a3557ba'), true);
assert.equal(isUuid('C5A698E7-C758-40E4-A73F-B7228A3557BA'), true);
for (const bad of ['-'.repeat(36), 'a'.repeat(36), '', 'c5a698e7c75840e4a73fb7228a3557ba', 'c5a698e7-c758-40e4-a73f-b7228a3557bz', null, 5]) {
  assert.equal(isUuid(bad), false, String(bad));
}
assert.deepEqual(safeName('slip.jpg', 'image/jpeg'), { ascii: 'slip.jpg', full: 'slip.jpg' });
assert.equal(safeName('evil.html', 'image/png').ascii, 'evil.png'); // extension comes from the mime
assert.equal(safeName('noext', 'application/pdf').ascii, 'noext.pdf');
assert.equal(safeName('فاتورة.pdf', 'application/pdf').ascii, 'document.pdf');
assert.equal(safeName('فاتورة.pdf', 'application/pdf').full, 'فاتورة.pdf');
assert.equal(safeName('', 'image/webp').ascii, 'photo.webp');
const nasty = safeName('a"b\r\nSet-Cookie: x=1;/..\\c.png', 'image/png');
assert.ok(!/[\r\n"\\/;]/.test(nasty.ascii + nasty.full), JSON.stringify(nasty));
const d = dispositionFor("it's (a) *name*.jpg", 'image/jpeg');
assert.match(d, /^inline; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
assert.ok(!/['()*]/.test(d.split("UTF-8''")[1]), d);
assert.ok(!/[\r\n]/.test(dispositionFor('x\r\ny', 'image/png')));
assert.doesNotThrow(() => dispositionFor('\ud800 lone', 'image/png'));
assert.equal(SERVE_HEADERS['Content-Security-Policy'], "default-src 'none'; sandbox");
