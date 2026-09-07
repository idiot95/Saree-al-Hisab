// Run through: node scripts/lib.test.mjs
import assert from 'node:assert/strict';
const { buildRule, parseRule, nextDates, describeRule } =
  await import(`${process.env.LIB}/recur.js`);

// ── round trip ─────────────────────────────────────────────────────────────
assert.equal(buildRule({ freq: 'MONTHLY', day: 5 }), 'FREQ=MONTHLY;BYMONTHDAY=5');
assert.equal(buildRule({ freq: 'YEARLY', day: 1, month: 4 }), 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=1');
assert.deepEqual(parseRule('FREQ=MONTHLY;BYMONTHDAY=5'), { freq: 'MONTHLY', day: 5 });
assert.deepEqual(parseRule('FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=1'), { freq: 'YEARLY', day: 1, month: 4 });

// Anything outside the subset is refused rather than half-understood.
assert.equal(parseRule('FREQ=WEEKLY;BYDAY=MO'), null);
assert.equal(parseRule('FREQ=MONTHLY;BYMONTHDAY=31'), null, 'the 31st does not exist in four months');
assert.equal(parseRule('FREQ=MONTHLY;BYMONTHDAY=0'), null);
assert.equal(parseRule('nonsense'), null);
assert.equal(parseRule('FREQ=YEARLY;BYMONTH=13;BYMONTHDAY=1'), null);

// ── when it next falls ─────────────────────────────────────────────────────
const R = 'FREQ=MONTHLY;BYMONTHDAY=5';
assert.deepEqual(nextDates(R, new Date(2026, 8, 1), 3), ['2026-09-05', '2026-10-05', '2026-11-05'],
  'before the day, this month counts');
assert.deepEqual(nextDates(R, new Date(2026, 8, 5), 2), ['2026-09-05', '2026-10-05'],
  'on the day, today counts');
assert.deepEqual(nextDates(R, new Date(2026, 8, 6), 2), ['2026-10-05', '2026-11-05'],
  'after the day, it has gone');
assert.deepEqual(nextDates(R, new Date(2026, 11, 20), 2), ['2027-01-05', '2027-02-05'],
  'December rolls into the next year');
assert.deepEqual(nextDates('FREQ=MONTHLY;BYMONTHDAY=28', new Date(2027, 0, 30), 1), ['2027-02-28'],
  'the 28th exists in February');

const Y = 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=1';
assert.deepEqual(nextDates(Y, new Date(2026, 8, 1), 2), ['2027-04-01', '2028-04-01'],
  'a yearly date already past waits for next year');
assert.deepEqual(nextDates(Y, new Date(2026, 2, 1), 1), ['2026-04-01'],
  'and is kept if it is still ahead');
assert.deepEqual(nextDates('rubbish', new Date(), 3), [], 'an unparsable rule yields no dates');

// ── said in words ──────────────────────────────────────────────────────────
assert.equal(describeRule(R), 'the 5th of every month');
assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=1'), 'the 1st of every month');
assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=2'), 'the 2nd of every month');
assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=3'), 'the 3rd of every month');
assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=11'), 'the 11th of every month');
assert.equal(describeRule(Y), 'the 1st of April, every year');
assert.equal(describeRule('bad'), 'on no schedule');

console.log('  ok   recurrence rules, dates and wording');

// ── which dues are outstanding ─────────────────────────────────────────────
const { outstandingDues } = await import(`${process.env.LIB}/recur.js`);
const MONTHLY = 'FREQ=MONTHLY;BYMONTHDAY=5';
const on = (y, m, d) => new Date(y, m - 1, d);

let dues = outstandingDues([{ id: 'rent', rrule: MONTHLY, settled: [] }], on(2026, 9, 1), 14);
assert.ok(dues.some((d) => d.dueOn === '2026-09-05'), 'a due four days ahead is listed');
assert.equal(dues.find((d) => d.dueOn === '2026-09-05').daysAway, 4);

// Anything already recorded drops out, however it was settled.
dues = outstandingDues([{ id: 'rent', rrule: MONTHLY, settled: ['2026-09-05'] }], on(2026, 9, 1), 14);
assert.ok(!dues.some((d) => d.dueOn === '2026-09-05'), 'a settled due is not offered again');

// A missed one keeps shouting rather than quietly disappearing.
dues = outstandingDues([{ id: 'rent', rrule: MONTHLY, settled: [] }], on(2026, 9, 20), 14);
assert.ok(dues.some((d) => d.dueOn === '2026-09-05'), 'a due that has passed unpaid is still listed');
assert.ok(dues.find((d) => d.dueOn === '2026-09-05').daysAway < 0, 'and reads as overdue');

// The horizon is real: nothing months away.
dues = outstandingDues([{ id: 'ins', rrule: 'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=1', settled: [] }],
  on(2026, 9, 1), 14);
assert.equal(dues.length, 0, 'a yearly bill in April is not shouted about in September');

// A schedule with no rule contributes nothing rather than throwing.
assert.deepEqual(outstandingDues([{ id: 'x', rrule: null, settled: [] }], on(2026, 9, 1)), []);

// Sorted by date across several schedules.
dues = outstandingDues([
  { id: 'a', rrule: 'FREQ=MONTHLY;BYMONTHDAY=10', settled: [], since: '2026-09-01' },
  { id: 'b', rrule: 'FREQ=MONTHLY;BYMONTHDAY=3', settled: [], since: '2026-09-01' },
], on(2026, 9, 1), 14);
assert.deepEqual(dues.map((d) => d.scheduleId), ['b', 'a'], 'the soonest comes first');

/* A schedule added today has not been missed for the months before it. Without
   this, every new schedule arrives shouting about rent it never knew about. */
dues = outstandingDues(
  [{ id: 'rent', rrule: MONTHLY, settled: [], since: '2026-09-01' }], on(2026, 9, 20), 14);
assert.deepEqual(dues.map((d) => d.dueOn), ['2026-09-05'],
  'only dues since the schedule existed count as missed');
dues = outstandingDues(
  [{ id: 'rent', rrule: MONTHLY, settled: [], since: '2026-09-10' }], on(2026, 9, 20), 14);
assert.equal(dues.length, 0, 'and none at all if it was created after this month\'s date');

console.log('  ok   outstanding dues, including the ones already missed');

// ── what "next" means once this month is dealt with ────────────────────────
const { nextUnsettled } = await import(`${process.env.LIB}/recur.js`);
assert.equal(nextUnsettled(MONTHLY, [], on(2026, 9, 5)), '2026-09-05',
  'unpaid and due today: next is today');
assert.equal(nextUnsettled(MONTHLY, ['2026-09-05'], on(2026, 9, 5)), '2026-10-05',
  'paid today: next is next month, not today repeated back');
assert.equal(nextUnsettled(MONTHLY, ['2026-09-05', '2026-10-05'], on(2026, 9, 5)), '2026-11-05',
  'two settled ahead: it keeps walking forward');
assert.equal(nextUnsettled(null, [], on(2026, 9, 5)), null);

console.log('  ok   the next unsettled date');
