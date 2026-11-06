// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { captureOrigin } = await import(`${process.env.LIB}/capture-origin.js`);

// AUTH_URL wins, and is never a preview.
assert.deepEqual(captureOrigin({ authUrl: 'https://saree-al-hisab.vercel.app/x', host: 'saree-al-hisab-abc123-team.vercel.app' }),
  { origin: 'https://saree-al-hisab.vercel.app', preview: false });
// Unparsable AUTH_URL: the request.
assert.equal(captureOrigin({ authUrl: 'not a url', host: 'books.example.com' }).origin, 'https://books.example.com');
// The production alias is not a preview; a per-deploy vercel.app host is.
assert.deepEqual(captureOrigin({ host: 'saree-al-hisab.vercel.app', productionHost: 'saree-al-hisab.vercel.app' }),
  { origin: 'https://saree-al-hisab.vercel.app', preview: false });
assert.equal(captureOrigin({ host: 'saree-al-hisab-git-main-team.vercel.app', productionHost: 'saree-al-hisab.vercel.app' }).preview, true);
assert.equal(captureOrigin({ host: 'Saree-Al-Hisab.vercel.app', productionHost: 'https://saree-al-hisab.vercel.app' }).preview, false,
  'case and a scheme on the alias do not matter');
// No alias known: any vercel.app host may die, so it is said.
assert.equal(captureOrigin({ host: 'saree-al-hisab.vercel.app' }).preview, true);
// VERCEL_ENV=preview on a custom host is a preview too; a custom production host is not.
assert.equal(captureOrigin({ host: 'pr-12.example.com', vercelEnv: 'preview' }).preview, true);
assert.equal(captureOrigin({ host: 'books.example.com', vercelEnv: 'production' }).preview, false);
// A key never travels in clear off the developer's machine; on it, http unless forwarded as https.
assert.equal(captureOrigin({ host: 'books.example.com', forwardedProto: 'http' }).origin, 'https://books.example.com');
assert.deepEqual(captureOrigin({ host: 'localhost:3000' }), { origin: 'http://localhost:3000', preview: false });
assert.equal(captureOrigin({ host: '127.0.0.1:3000', forwardedProto: 'https, http' }).origin, 'https://127.0.0.1:3000');
assert.equal(captureOrigin({ host: '[::1]:3000', vercelEnv: 'preview' }).preview, false);

console.log('capture-origin: ok');
