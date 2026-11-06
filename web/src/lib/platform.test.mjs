import assert from 'node:assert/strict';
const { platformOf } = await import(`${process.env.LIB}/platform.js`);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

assert.equal(platformOf(IPHONE), 'ios');
assert.equal(platformOf(IPAD, null), 'ios');
assert.equal(platformOf('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)'), 'ios');
assert.equal(platformOf(MAC, null), 'other');
assert.equal(platformOf(PIXEL), 'android');
assert.equal(platformOf(MAC, '"Android"'), 'android');
assert.equal(platformOf('', '"Android"'), 'android');
assert.equal(platformOf('', '"Windows"'), 'other');
assert.equal(platformOf(''), 'other');
assert.equal(platformOf('', null), 'other');
