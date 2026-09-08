// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const {
  findRef, defaultRef, pickWay, payLabel, viaRails, ownRail, accountRef, railRef,
} = await import(`${process.env.LIB}/pay.js`);

const hdfc = { id: 'A1', name: 'HDFC Savings', kind: 'spending', rails: [
  { id: 'R1', name: 'GPay', kind: 'upi', is_default: true },
  { id: 'R2', name: 'Net banking', kind: 'netbanking' },
] };
const icici = { id: 'A2', name: 'ICICI Savings', kind: 'spending', rails: [] };
const cash = { id: 'A3', name: 'Cash', kind: 'cash', rails: [{ id: 'R3', name: 'cash ', kind: 'cash' }] };
const card = { id: 'A4', name: 'HDFC Regalia', kind: 'credit', rails: [{ id: 'R4', name: 'HDFC Regalia', kind: 'card' }] };
const ways = [hdfc, icici, cash, card];

// Either spelling finds its pair; a bare id is an old phone's rail.
assert.deepEqual(findRef(ways, 'm:R2'), { way: hdfc, rail: hdfc.rails[1] });
assert.deepEqual(findRef(ways, 'a:A2'), { way: icici, rail: null });
assert.deepEqual(findRef(ways, 'R1'), { way: hdfc, rail: hdfc.rails[0] });
assert.equal(findRef(ways, 'm:nope'), null);
assert.equal(findRef(ways, 'a:R1'), null);   // a rail id is not an account
assert.equal(findRef(ways, 'x:A1'), null);
assert.equal(findRef(ways, ''), null);
assert.equal(findRef(ways, null), null);
assert.equal(findRef(ways, 42), null);      // a direct POST can send anything

// The default is the marked rail, else any rail, else an account, else nothing.
assert.equal(defaultRef(ways), 'm:R1');
assert.equal(defaultRef([icici, cash]), 'm:R3');
assert.equal(defaultRef([icici]), 'a:A2');
assert.equal(defaultRef([]), '');

// An account's own-named rail IS the account: case and spacing do not split them.
assert.equal(ownRail(cash), cash.rails[0]);
assert.equal(ownRail(card), card.rails[0]);
assert.equal(ownRail(hdfc), null);
// The card rail on a credit card is the card, whatever it is called.
const amazon = { id: 'A5', name: 'ICICI Amazon Pay', kind: 'credit', rails: [
  { id: 'R5', name: 'Amazon Pay card', kind: 'card' }, { id: 'R6', name: 'Auto-debit', kind: 'autodebit' },
] };
assert.equal(ownRail(amazon), amazon.rails[0]);
assert.deepEqual(viaRails(amazon), [amazon.rails[1]]);
assert.equal(payLabel(amazon, amazon.rails[0]), 'ICICI Amazon Pay');
assert.equal(ownRail({ ...hdfc, rails: [{ id: 'R7', name: 'Debit card', kind: 'card' }] }), null); // a card on a bank is a rail
assert.deepEqual(viaRails(hdfc), hdfc.rails);
assert.deepEqual(viaRails(cash), []);

// Tapping an account lands on the sensible rail without a second tap.
assert.equal(pickWay(hdfc), 'm:R1');    // its default
assert.equal(pickWay(cash), 'm:R3');    // its own
assert.equal(pickWay(icici), 'a:A2');   // nothing to draw with: the account
assert.equal(pickWay({ ...hdfc, rails: [hdfc.rails[1]] }), 'm:R2');  // first rail when none is marked

// Words: the rail and its account, unless they are the same thing.
assert.equal(payLabel(hdfc, hdfc.rails[0]), 'GPay · HDFC Savings');
assert.equal(payLabel(hdfc, null), 'HDFC Savings');
assert.equal(payLabel(cash, cash.rails[0]), 'Cash');

assert.equal(accountRef('A9'), 'a:A9');
assert.equal(railRef('R9'), 'm:R9');
console.log('  ok   ways to pay');

// The flat list: each account's apps and cards, then the account itself,
// the household's default first; an account and its own-named rail are one.
{
  const { flatWays, isFlat } = await import(`${process.env.LIB}/pay.js`);
  const flat = flatWays(ways);
  assert.deepEqual(flat.map((f) => f.ref), ['m:R1', 'm:R2', 'a:A1', 'a:A2', 'm:R3', 'm:R4']);
  assert.equal(flat[0].rail, hdfc.rails[0]);
  assert.equal(flat[4].way, cash);
  assert.ok(isFlat(findRef(ways, 'm:R3'), flat[4]));
  assert.ok(isFlat(findRef(ways, 'a:A3'), flat[4]));   // the account spelling of the same thing
  assert.ok(isFlat(findRef(ways, 'a:A1'), flat[2]));
  assert.ok(!isFlat(findRef(ways, 'a:A1'), flat[0]));  // directly is not GPay
  assert.ok(!isFlat(null, flat[0]));
  assert.deepEqual(flatWays([]), []);
  // No default marked: whatever defaultRef picks (any rail before a bare
  // account) still leads, then the accounts' own order.
  const plain = [{ ...icici }, { ...cash }];
  assert.deepEqual(flatWays(plain).map((f) => f.ref), ['m:R3', 'a:A2']);
  assert.deepEqual(flatWays([{ ...icici }]).map((f) => f.ref), ['a:A2']);
}
