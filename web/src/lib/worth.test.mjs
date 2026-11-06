// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { netWorth } = await import(`${process.env.LIB}/worth.js`);

// The formula as it stood before holdings and owners: the household figure must still equal it.
function oldNetWorth(accounts, claimed, held) {
  const own = accounts.filter((a) => a.kind !== 'person');
  const people = accounts.filter((a) => a.kind === 'person');
  const lent = people.filter((a) => Number(a.balance) > 0);
  const borrowed = people.filter((a) => Number(a.balance) < 0);
  const assets = own.filter((a) => Number(a.balance) > 0);
  const debts = [...own.filter((a) => Number(a.balance) < 0), ...borrowed];
  const assetTotal = assets.reduce((n, a) => n + Number(a.balance), 0);
  const debtTotal = debts.reduce((n, a) => n + Number(a.balance), 0);
  const claims = claimed + held;
  const receivable = lent.reduce((n, a) => n + Number(a.balance), 0) + claims;
  const savings = own.filter((a) => a.kind === 'savings').reduce((n, a) => n + Number(a.balance), 0);
  return { worth: assetTotal + receivable + debtTotal, assetTotal, debtTotal, receivable, claims, savings, assets, debts, lent, borrowed, own };
}

const acc = (id, kind, balance, owner) => ({ id, name: id, kind, balance, owner_user_id: owner });
const MEMBERS = ['u1', 'u2'];
const accounts = [
  acc('bank', 'spending', '5000000', 'u1'),
  acc('cash', 'cash', '120000', null),
  acc('fd', 'savings', '3000000', 'u2'),
  acc('card', 'credit', '-450000', 'u1'),
  acc('card2', 'credit', '-90000', 'u2'),
  acc('ravi', 'person', '200000', null),     // lent
  acc('sana', 'person', '-75000', null),     // borrowed
];
const hv = (id, owner, value) => ({ id, kind: 'metal', name: id, owner_user_id: owner, value_minor: value, rate_as_of: '2026-11-01' });

// 1. Household, no holdings, equals the old formula.
{
  const old = oldNetWorth(accounts, 30000, 12000);
  const r = netWorth({ accounts, claimed: 30000, held: 12000, members: MEMBERS });
  for (const k of Object.keys(old)) {
    if (Array.isArray(old[k])) assert.deepEqual(r[k], old[k], k); else assert.equal(r[k], old[k], k);
  }
  assert.equal(r.accountAssetTotal, old.assetTotal);
  assert.equal(r.holdingTotal, 0);
  assert.deepEqual(r.unvalued, []);
  const explicit = netWorth({ accounts, claimed: 30000, held: 12000, members: MEMBERS }, { kind: 'household' });
  assert.equal(explicit.worth, old.worth);
}

// 2. Holdings add to assetTotal, holdingTotal and worth.
{
  const base = netWorth({ accounts, claimed: 0, held: 0, members: MEMBERS });
  const r = netWorth({ accounts, claimed: 0, held: 0, holdings: [hv('gold', 'u1', '800000'), hv('usd', null, '250000')], members: MEMBERS });
  assert.equal(r.holdingTotal, 1050000);
  assert.equal(r.assetTotal, base.assetTotal + 1050000);
  assert.equal(r.accountAssetTotal, base.assetTotal);
  assert.equal(r.worth, base.worth + 1050000);
}

// 3. A holding with no rate is listed apart and not summed.
{
  const r = netWorth({ accounts, claimed: 0, held: 0, holdings: [hv('gold', 'u1', '800000'), hv('silver', 'u1', null)], members: MEMBERS });
  assert.equal(r.holdingTotal, 800000);
  assert.deepEqual(r.unvalued.map((h) => h.id), ['silver']);
}

// 4. Member filter: only that member's accounts and holdings, no receivable, only their debts.
{
  const r = netWorth({ accounts, claimed: 30000, held: 12000, holdings: [hv('gold', 'u1', '800000'), hv('g2', 'u2', '100000'), hv('x', 'u1', null)], members: MEMBERS },
    { kind: 'member', userId: 'u1' });
  assert.equal(r.receivable, 0);
  assert.equal(r.claims, 0);
  assert.equal(r.assetTotal, 5000000 + 800000);
  assert.equal(r.debtTotal, -450000); // u2's card (-90000) is not u1's
  assert.equal(r.holdingTotal, 800000);
  assert.equal(r.worth, 5000000 + 800000 - 450000);
  assert.deepEqual(r.unvalued.map((h) => h.id), ['x']);
  assert.deepEqual(r.lent, []);
  assert.deepEqual(r.borrowed, []);
}

// 5. Joint filter: owner-null items plus receivables, including person accounts.
{
  const r = netWorth({ accounts, claimed: 30000, held: 12000, holdings: [hv('gold', 'u1', '800000'), hv('usd', null, '250000')], members: MEMBERS },
    { kind: 'joint' });
  assert.equal(r.assetTotal, 120000 + 250000);
  assert.equal(r.holdingTotal, 250000);
  assert.equal(r.receivable, 200000 + 42000);
  assert.equal(r.debtTotal, -75000);
  assert.equal(r.worth, 120000 + 250000 + 242000 - 75000);
}

// 6. A former member's items count in household and land in joint; not under a member filter.
{
  const input = { accounts: [acc('old', 'spending', '100000', 'u9'), acc('oldcard', 'credit', '-30000', 'u9'), acc('b', 'spending', '50000', 'u1')],
    claimed: 0, held: 0, holdings: [hv('gold', 'u9', '700000')], members: ['u1'] };
  assert.equal(netWorth(input).worth, 820000);
  const j = netWorth(input, { kind: 'joint' });
  assert.equal(j.worth, 770000);
  assert.equal(j.debtTotal, -30000);
  assert.equal(j.holdingTotal, 700000);
  assert.equal(netWorth(input, { kind: 'member', userId: 'u1' }).worth, 50000);
}

console.log('  worth: ok');

assert.throws(() => netWorth({ accounts, claimed: 0, held: 0 }), /member ids/);
