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
const rent = { rrule: MONTHLY };
assert.equal(nextUnsettled(rent, [], on(2026, 9, 5)), '2026-09-05',
  'unpaid and due today: next is today');
assert.equal(nextUnsettled(rent, ['2026-09-05'], on(2026, 9, 5)), '2026-10-05',
  'paid today: next is next month, not today repeated back');
assert.equal(nextUnsettled(rent, ['2026-09-05', '2026-10-05'], on(2026, 9, 5)), '2026-11-05',
  'two settled ahead: it keeps walking forward');
assert.equal(nextUnsettled({ rrule: null }, [], on(2026, 9, 5)), null);

console.log('  ok   the next unsettled date');

// ── a rule that ends ───────────────────────────────────────────────────────
const { isFinished, friendlyDate, ruleOf, maxDay } = await import(`${process.env.LIB}/recur.js`);
const FIVE = 'FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20270105';
assert.equal(buildRule({ freq: 'MONTHLY', day: 5, until: '2027-01-05' }), FIVE, 'UNTIL is written in RFC 5545 DATE form');
assert.deepEqual(parseRule(FIVE), { freq: 'MONTHLY', day: 5, until: '2027-01-05' }, 'and read back as a ledger date');
assert.equal(parseRule('FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=2027-01-05'), null, 'a dashed UNTIL is not the spec');
assert.equal(parseRule('FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20270230'), null, 'nor is a day that does not exist');
assert.deepEqual(nextDates(FIVE, on(2026, 9, 1), 12),
  ['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05', '2027-01-05'],
  '"for five months" is five dates, however many were asked for');
assert.deepEqual(nextDates(FIVE, on(2027, 2, 1), 3), [], 'and none at all once it has ended');
assert.equal(describeRule(FIVE), 'the 5th of every month, until 5 Jan 2027');
assert.equal(friendlyDate('2027-01-05'), '5 Jan 2027');
assert.equal(isFinished({ rrule: FIVE }, on(2027, 1, 5)), false, 'the last day is still on');
assert.equal(isFinished({ rrule: FIVE }, on(2027, 1, 6)), true, 'the day after, it is done');
assert.equal(isFinished({ rrule: MONTHLY }, on(2030, 1, 1)), false, 'no end, never finished');
assert.equal(nextUnsettled({ rrule: FIVE }, [], on(2027, 3, 1)), null, 'nothing next after the end');
assert.deepEqual(outstandingDues([{ id: 'x', rrule: FIVE, settled: [], since: '2027-01-01' }], on(2027, 2, 1), 14).map((d) => d.dueOn),
  ['2027-01-05'], 'the missed last one is still owed');
assert.equal(outstandingDues([{ id: 'x', rrule: FIVE, settled: ['2027-01-05'], since: '2027-01-01' }], on(2027, 2, 1), 14).length, 0);

console.log('  ok   rules that end');

// ── the same rules on the Hijri calendar ───────────────────────────────────
// 1 Moharram 1448 is 15 June 2026; 1 Ramadaan 1447 was 17 Feb 2026.
const RAMADAAN = 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1';
assert.deepEqual(parseRule(RAMADAAN, 'hijri'), { freq: 'YEARLY', day: 1, month: 9 });
assert.deepEqual(nextDates(RAMADAAN, on(2026, 9, 1), 2, 'hijri'), ['2027-02-06', '2028-01-27'],
  'Ramadaan comes eleven days earlier each year');
assert.deepEqual(nextDates(RAMADAAN, on(2026, 2, 17), 1, 'hijri'), ['2026-02-17'], 'on the day, today counts');
assert.deepEqual(nextDates(RAMADAAN, on(2026, 2, 18), 1, 'hijri'), ['2027-02-06'], 'the day after, it has gone');
assert.deepEqual(nextDates('FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1', on(2026, 6, 1), 1, 'hijri'), ['2026-06-15'],
  'the new year, 1 Moharram 1448');
assert.deepEqual(nextDates('FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=10', on(2026, 1, 1), 1, 'hijri'), ['2026-05-26'],
  'Eid al-Adha, 10 Zilhaj 1447');
const H = 'FREQ=MONTHLY;BYMONTHDAY=1';
const twelve = nextDates(H, on(2026, 6, 15), 12, 'hijri');
assert.equal(twelve[0], '2026-06-15', 'the first of the month, starting on 1 Moharram');
const gap = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
for (let i = 1; i < 12; i++) assert.ok([29, 30].includes(gap(twelve[i - 1], twelve[i])), 'each Hijri month is 29 or 30 days');
assert.equal(gap(twelve[0], nextDates(H, on(2026, 6, 15), 13, 'hijri')[12]), 355, 'twelve of them make a year — 355 days, 1448 being Kabisa');

assert.equal(parseRule('FREQ=MONTHLY;BYMONTHDAY=30', 'hijri'), null, 'a Hijri month may have only 29 days');
assert.deepEqual(parseRule('FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=30', 'hijri'), { freq: 'YEARLY', day: 30, month: 9 },
  'but Ramadaan always has 30');
assert.equal(parseRule('FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=30', 'hijri'), null, 'Zilhaj only in a Kabisa year, so no');
assert.equal(parseRule('FREQ=MONTHLY;BYMONTHDAY=29'), null, 'and the Gregorian cap is still 28');
assert.equal(maxDay('hijri', 'YEARLY', 3), 30); assert.equal(maxDay('hijri', 'MONTHLY'), 29); assert.equal(maxDay('gregorian', 'YEARLY', 1), 28);

assert.equal(describeRule(RAMADAAN, 'hijri'), 'the 1st of Ramadaan, every year');
assert.equal(describeRule(H, 'hijri'), 'the 1st of every Hijri month');
assert.equal(describeRule('FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1;UNTIL=20280201', 'hijri'),
  'the 1st of Ramadaan, every year, until 1 Feb 2028');
assert.deepEqual(nextDates('FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1;UNTIL=20280201', on(2026, 9, 1), 5, 'hijri'),
  ['2027-02-06', '2028-01-27'], 'an end date on a Hijri rule is still a Gregorian day');

// The schedule carries whichever column it was written in.
assert.deepEqual(ruleOf({ rrule: null, hijri_rule: RAMADAAN }), { rule: RAMADAAN, cal: 'hijri' });
assert.deepEqual(ruleOf({ rrule: MONTHLY, hijri_rule: null }), { rule: MONTHLY, cal: 'gregorian' });
assert.equal(ruleOf({ rrule: null, hijri_rule: null }), null);
dues = outstandingDues([{ id: 'zakat', rrule: null, hijri_rule: RAMADAAN, settled: [], since: '2026-01-01' }], on(2027, 2, 1), 14);
assert.deepEqual(dues.map((d) => d.dueOn), ['2027-02-06'], 'a Hijri due surfaces on its Gregorian day');
assert.equal(nextUnsettled({ rrule: null, hijri_rule: RAMADAAN }, ['2027-02-06'], on(2027, 2, 1)), '2028-01-27');
assert.equal(isFinished({ rrule: null, hijri_rule: 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1;UNTIL=20280201' }, on(2028, 3, 1)), true);

console.log('  ok   the same rules on the Hijri calendar');

/* ── a due that was moved, and a rule rewritten to the new day ──────────── */
{
  const { datesInMonth, rewriteRuleTo } = await import(`${process.env.LIB}/recur.js`);
  const rent = { id: 'rent', rrule: 'FREQ=MONTHLY;BYMONTHDAY=5', hijri_rule: null, settled: ['2026-08-05'],
                 since: '2026-01-01', moved: [{ from: '2026-09-05', to: '2026-09-10' }] };
  let d = outstandingDues([rent], on(2026, 9, 8), 14);
  assert.deepEqual(d.map((x) => [x.dueOn, x.on, x.daysAway, x.movedFrom]),
    [['2026-09-05', '2026-09-10', 2, '2026-09-05']], 'a moved due keeps the rule date as its identity and is owed on the new day');
  d = outstandingDues([{ ...rent, moved: [{ from: '2026-09-05', to: '2026-10-20' }] }], on(2026, 9, 8), 14);
  assert.deepEqual(d, [], 'moved past the horizon, it is not yet owed');
  assert.equal(nextUnsettled(rent, [], on(2026, 9, 1)), '2026-09-10', 'and "next" says the moved day');
  assert.equal(nextUnsettled(rent, ['2026-09-05'], on(2026, 9, 1)), '2026-10-05', 'once settled, the month after');
  d = outstandingDues([{ ...rent, moved: [] }], on(2026, 9, 8), 14);
  assert.equal(d[0].on, d[0].dueOn, 'unmoved, the two days are one');
  assert.equal(d[0].movedFrom, undefined);

  // A rewritten rule does not owe the dates before the rewrite.
  d = outstandingDues([{ ...rent, rrule: 'FREQ=MONTHLY;BYMONTHDAY=10', moved: [], settled: [], since: '2026-09-10' }], on(2026, 9, 8), 14);
  assert.deepEqual(d.map((x) => x.on), ['2026-09-10'], 'the 10th of August was under the old rule and is not missed');

  assert.deepEqual(datesInMonth('FREQ=MONTHLY;BYMONTHDAY=5', 'gregorian', 2026, 9), ['2026-09-05']);
  assert.deepEqual(datesInMonth('FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=5', 'gregorian', 2026, 9), []);
  assert.deepEqual(datesInMonth('FREQ=MONTHLY;BYMONTHDAY=1', 'hijri', 2026, 8), ['2026-08-13'], '1 Rabi al-Awwal 1448');
  assert.deepEqual(datesInMonth('FREQ=MONTHLY;BYMONTHDAY=1', 'hijri', 2026, 6), ['2026-06-15'], '1 Moharram 1448');
  assert.deepEqual(datesInMonth('FREQ=MONTHLY;BYMONTHDAY=29', 'hijri', 2028, 1), ['2028-01-26'],
    '29 Shabaan 1449 — a Hijri day does not straddle');

  assert.equal(rewriteRuleTo('FREQ=MONTHLY;BYMONTHDAY=5', 'gregorian', '2026-09-10'), 'FREQ=MONTHLY;BYMONTHDAY=10');
  assert.equal(rewriteRuleTo('FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20270105', 'gregorian', '2026-09-10'),
    'FREQ=MONTHLY;BYMONTHDAY=10;UNTIL=20270105', 'the end stays');
  assert.equal(rewriteRuleTo('FREQ=MONTHLY;BYMONTHDAY=5', 'gregorian', '2026-09-30'), null, 'the 30th cannot be every month');
  assert.equal(rewriteRuleTo('FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=5', 'gregorian', '2026-09-10'), 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=10');
  assert.equal(rewriteRuleTo('FREQ=MONTHLY;BYMONTHDAY=1', 'hijri', '2026-09-14'), 'FREQ=MONTHLY;BYMONTHDAY=3',
    '14 Sep 2026 is 3 Rabi II, so the 3rd of every Hijri month');
  assert.equal(rewriteRuleTo('FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=1', 'hijri', '2027-02-09'), 'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=4');
  assert.equal(rewriteRuleTo('FREQ=MONTHLY;BYMONTHDAY=1', 'hijri', '2026-09-11'), null, '30 Rabi I — no Hijri month is sure to have a 30th');
  assert.equal(rewriteRuleTo('FREQ=MONTHLY;BYMONTHDAY=5', 'gregorian', '2026-02-30'), null);
  console.log('  ok   moved dues, and a rule rewritten to the new day');
}
