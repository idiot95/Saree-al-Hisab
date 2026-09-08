// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { fits, misfit, isScope } = await import(`${process.env.LIB}/scope.js`);

assert.equal(fits('expense', 'expense'), true);
assert.equal(fits('expense', 'refund'), true);
assert.equal(fits('expense', 'transfer'), true);
assert.equal(fits('expense', 'income'), false);
assert.equal(fits('income', 'income'), true);
assert.equal(fits('income', 'expense'), false);
assert.equal(fits('both', 'income'), true);
assert.equal(fits('both', 'expense'), true);
// A row from before scope existed, or a queued pick without one, is spending.
assert.equal(fits(undefined, 'expense'), true);
assert.equal(fits(null, 'income'), false);
assert.match(misfit('income', 'Groceries'), /Groceries is for spending/);
assert.match(misfit('expense', 'Salary'), /Salary is for income/);
assert.equal(isScope('both'), true);
assert.equal(isScope('all'), false);
console.log('  ok   category scope');
