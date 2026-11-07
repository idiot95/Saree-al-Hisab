'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { buildRule, describeRule, friendlyDay, maxDay, nextDates, type Calendar } from '@/lib/recur';
import { HIJRI_MONTHS_SHORT, formatHijri, toHijri } from '@/lib/hijri';
import { DateChips, DayOfMonth, MonthOfYear, Segmented } from '../DatePick';
import { createSchedule } from './actions';
import { useFocusSoon, useKeepOnRefusal, useOnSuccess } from '../form-hooks';
import PayPicker, { CHIP, CHIP_TEXT } from '../PayPicker';
import CategoryPick from '../CategoryPick';
import type { Category } from '../CategoryFinder';
import { defaultRef, type Way } from '@/lib/pay';
import { fits } from '@/lib/scope';
import { choice } from '../choice';
import { Icon } from '../Icon';
import { AddRow, Said, fieldLabel, formCard, ghost, solid } from '../form-bits';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Two calendars, one grammar. A household here keeps Hijri dates for the
   things that matter most — Ramadaan, Eid, Ashara, the yearly dues — and the
   Misri calendar is arithmetic, so "the 1st of Ramadaan" is a real date on
   the phone years ahead. The month names are the ones the community uses. */
const CALENDARS = [['gregorian', 'English'], ['hijri', 'Hijri']] as const;
const REPEATS = [['MONTHLY', 'Every month'], ['YEARLY', 'Once a year']] as const;
const ENDS = [['never', 'Never'], ['after', 'After a number'], ['on', 'On a date']] as const;

/* The form asks for a day the way the person thinks of it — the 5th, the
   1st of Ramadaan — as taps on a grid, and says back in one sentence what
   the rule will be and when it first lands. The end is one line, "Ends
   never", until someone wants otherwise. */

export default function NewSchedule({ startOpen = false, ...form }: {
  ways: Way[]; categories: Category[]; tabs: { id: string; name: string }[]; startOpen?: boolean;
}) {
  /* The form is its own component, so closing it (Cancel, or a success) drops every choice with it: the next
     one starts from the defaults in React's state and in the DOM alike. */
  const [open, setOpen] = useState(startOpen);
  /* Closed (a save or Cancel), focus goes back to the add row the form replaced; a save is said in the live
     region, which stays here because the form that knew the message has gone. */
  const [said, setSaid] = useState('');
  const [opener, focusOpener] = useFocusSoon<HTMLButtonElement>();
  return (<>
    <Said>{said}</Said>
    {open
      ? <ScheduleForm {...form} onClose={(message) => { setOpen(false); setSaid(message ?? ''); focusOpener(); }} />
      : (
        <div className="mx-[var(--gutter)]">
          <AddRow ref={opener} onClick={() => { setSaid(''); setOpen(true); }}>Add a payment or income that comes round</AddRow>
        </div>
      )}
  </>);
}

function ScheduleForm({ ways, categories, tabs, onClose }: {
  ways: Way[]; categories: Category[]; tabs: { id: string; name: string }[]; onClose: (message?: string) => void;
}) {
  const [state, act, pending] = useActionState(createSchedule, null);
  /* It can open itself (?new=1, a plain link), so it posts directly and works without script; with script, a
     refusal's form reset is undone so Income, Once a year, Hijri and the rest stay as chosen for the resubmit. */
  const keep = useKeepOnRefusal(state);
  // Saved: close, so the reset React does after a success never leaves this form's switches and DOM disagreeing.
  useOnSuccess(state, () => onClose(state?.ok ? state.message : undefined));
  const [freq, setFreq] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [counts, setCounts] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [cal, setCal] = useState<Calendar>('gregorian');
  const [month, setMonth] = useState({ gregorian: 4, hijri: 9 });   // April; Ramadaan
  const [day, setDay] = useState({ gregorian: 5, hijri: 1 });
  const [ends, setEnds] = useState<'never' | 'after' | 'on'>('never');
  const [endsOpen, setEndsOpen] = useState(false);
  const [times, setTimes] = useState(12);
  const [untilDate, setUntilDate] = useState('');
  // Fixed once, at open, so a render is not a clock and nothing flickers at midnight.
  const [today] = useState(() => new Date());

  const top = maxDay(cal, freq, month[cal]);
  const chosenDay = Math.min(day[cal], top);
  const base = freq === 'YEARLY'
    ? buildRule({ freq: 'YEARLY', day: chosenDay, month: month[cal] })
    : buildRule({ freq: 'MONTHLY', day: chosenDay });
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // The same arithmetic the server will do, shown before anyone commits to it.
  const first = nextDates(base, today, 1, cal)[0];
  const last = ends === 'after'
    ? nextDates(base, today, Math.min(Math.max(times, 1), 600), cal).at(-1)
    : ends === 'on' && untilDate
      ? nextDates(base, today, 600, cal).filter((d) => d <= untilDate).at(-1)
      : undefined;
  const monthNames = cal === 'hijri' ? HIJRI_MONTHS_SHORT : MON;
  const sentence = describeRule(base, cal);
  // Salary is not a place to file the rent: the list follows the tab.
  const offered = categories.filter((c) => fits(c.scope, kind));
  const endsLine = ends === 'never' ? 'Ends never'
    : ends === 'after' ? `Ends after ${times === 1 ? 'once' : `${times} times`}${last ? `, on ${friendlyDay(last, iso)}` : ''}`
    : untilDate ? `Ends on ${friendlyDay(untilDate, iso)}${last && last !== untilDate ? ` — the last is ${friendlyDay(last, iso)}` : ''}` : 'Ends on a date';
  const later = [[6, 'In 6 months'], [12, 'In a year'], [24, 'In 2 years']] as const;

  return (
    <form action={act} {...keep} aria-label="Add a regular payment" className={`mx-[var(--gutter)] ${formCard}`}>
      <div role="radiogroup" aria-label="Expense or income" className="flex gap-0.5 rounded-full bg-muted p-[3px]">
        {([['expense', 'Expense'], ['income', 'Income']] as const).map(([id, label]) => {
          const on = kind === id;
          return (
            <label key={id}
              className={`relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full text-body font-semibold ${on ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}>
              <input type="radio" name="kind" value={id} checked={on} onChange={() => setKind(id)}
                className="absolute size-px opacity-0" />
              {label}
            </label>
          );
        })}
      </div>
      <Field label="What is it" name="name" required maxLength={60}
        placeholder={kind === 'income' ? 'Salary' : 'Rent'} autoFocus />
      <Field label="Amount" name="amount" inputMode="decimal" required
        placeholder={kind === 'income' ? '120000' : '45000'} />

      <div className="flex flex-col gap-2">
        <div className={row}>
          <span className={rowLabel}>Repeats</span>
          <Segmented name="freq" value={freq} options={REPEATS} onChange={setFreq} label="How often it repeats" />
        </div>
        <div className={row}>
          <span className={rowLabel}>Calendar</span>
          <Segmented name="calendar" value={cal} options={CALENDARS} onChange={setCal} label="Which calendar" />
        </div>

        {freq === 'YEARLY' && (
          <MonthOfYear value={month[cal]} names={monthNames} label={cal === 'hijri' ? 'Hijri month' : 'Month'}
            onPick={(v) => setMonth({ ...month, [cal]: v })} />
        )}
        <input type="hidden" name="month" value={month[cal]} />
        <DayOfMonth value={chosenDay} top={top} onPick={(v) => setDay({ ...day, [cal]: v })} />
        <input type="hidden" name="day" value={chosenDay} />

        {/* What the rule will be, in one sentence, and when it first lands. */}
        <p className="mt-0.5 flex items-start gap-2 rounded-xl bg-accent px-3.5 py-3 text-accent-foreground">
          <Icon name="event_repeat" size={18} className="mt-px" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body font-semibold leading-snug">
              {sentence.charAt(0).toUpperCase()}{sentence.slice(1)}
            </span>
            <span className="text-subhead leading-snug">
              {first ? `First on ${friendlyDay(first, iso)}` : 'No date ahead'}
              {cal === 'hijri' && first && ` · ${formatHijri(toHijri(civil(first)), true)}`}
              {cal === 'hijri'
                ? `. Today is ${formatHijri(toHijri({ y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }), true)} by the Misri calendar.`
                : '. Days stop at the 28th so it lands in every month.'}
            </span>
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {!endsOpen ? (
          <div className={row}>
            <span className="flex-1 text-body font-semibold">{endsLine}</span>
            <input type="hidden" name="ends" value="never" />
            <button type="button" onClick={() => setEndsOpen(true)}
              className="press flex min-h-11 items-center gap-1 rounded-full bg-muted px-3.5 text-body font-semibold text-primary">
              <Icon name="edit" size={16} />Change
            </button>
          </div>
        ) : (
          <>
            <div className={row}>
              <span className={rowLabel}>Ends</span>
              <Segmented name="ends" value={ends} options={ENDS} label="When it ends"
                onChange={(v) => { setEnds(v); if (v === 'on' && !untilDate) setUntilDate(addMonths(iso, 12)); }} />
            </div>
            {ends === 'after' && (
              <div className="flex items-center gap-2">
                <button type="button" aria-label="One fewer" onClick={() => setTimes(Math.max(1, times - 1))} className={stepBtn}>
                  <Icon name="remove" size={20} />
                </button>
                <input name="times" type="number" inputMode="numeric" min={1} max={600} required
                  value={times} onChange={(e) => setTimes(Math.min(600, Math.max(1, Number(e.target.value) || 1)))}
                  aria-label="How many times"
                  className="h-12 w-[76px] rounded-xl border border-input bg-card text-center text-[length:var(--field)] font-semibold tabular-nums text-foreground" />
                <button type="button" aria-label="One more" onClick={() => setTimes(Math.min(600, times + 1))} className={stepBtn}>
                  <Icon name="add" size={20} />
                </button>
                <span className="flex-1 text-subhead leading-snug text-muted-foreground">
                  {times === 1 ? 'once' : `${times} times`}{last ? `, the last on ${friendlyDay(last, iso)}` : ''}
                </span>
              </div>
            )}
            {ends === 'on' && (
              <>
                <DateChips value={untilDate || addMonths(iso, 12)} today={iso} dir="future" min={iso} label="Last day"
                  quick={later.map(([n, text]) => ({ iso: addMonths(iso, n), label: text }))}
                  onChange={setUntilDate} />
                <input type="hidden" name="untilDate" value={untilDate || addMonths(iso, 12)} />
                <span className="text-subhead leading-snug text-muted-foreground">
                  {last ? `The last is ${friendlyDay(last, iso)}.` : 'None before then.'}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div role="group" aria-label={kind === 'income' ? 'How it comes in' : 'How it is paid'} className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{kind === 'income' ? 'How it comes in' : 'How it is paid'}</span>
        <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
      </div>
      <CategoryPick name="categoryId" categories={offered}
        label={kind === 'income' ? 'What for' : 'Category'}
        placeholder={offered.length ? 'Choose a category' : 'No categories for this yet'} />

      {/* A standing cost can belong to a tab, and every due it records lands
          there and claims the same shares a one-off would. */}
      {tabs.length > 0 && (
        <div role="group" aria-label="On a tab (optional)" className="flex flex-col gap-1.5">
          <span className={fieldLabel}>On a tab (optional)</span>
          <input type="hidden" name="bookId" value={bookId ?? ''} />
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const on = t.id === bookId;
              return (
                <button key={t.id} type="button" aria-pressed={on}
                  onClick={() => setBookId(on ? null : t.id)}
                  style={{ ...CHIP, ...choice(on) }}>
                  <Icon name="tab" size={16} />
                  <span style={CHIP_TEXT}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The same question a one-off expense answers, asked once for a rule
          that will answer it every month. Rent fronted for a cousin is never
          your spending however many times it goes out. */}
      {kind === 'expense' && (
        <div role="group" aria-label="Is this your own spending?" className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Is this your own spending?</span>
          <input type="hidden" name="counts_as_spend" value={counts ? 'yes' : 'no'} />
          <div className="flex gap-2">
            {([
              [true, 'receivable', 'Yes, mine', 'Counts in the budget, even if paid back'],
              [false, 'person', 'No, I covered it', 'Owed back, never counted as spending'],
            ] as const).map(([v, icon, label, what]) => (
              <button key={String(v)} type="button" aria-pressed={counts === v}
                onClick={() => setCounts(v)}
                className={`flex min-h-14 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left ${counts === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                <Icon name={icon} size={18} />
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="text-body font-semibold">{label}</span>
                  <span className="text-footnote leading-snug opacity-80">{what}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex gap-2">
        <button type="button" onClick={() => onClose()} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending} className={solid}>{pending ? 'Saving…' : 'Add it'}</button>
      </div>
    </form>
  );
}

const row = 'flex min-h-11 items-center gap-2.5';
const rowLabel = `w-[74px] flex-none ${fieldLabel}`;
const stepBtn = 'press grid size-11 flex-none place-items-center rounded-full bg-muted text-foreground';

const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
/** The same day n months on, or the month's last day when it has no such day. */
function addMonths(iso: string, n: number) {
  const { y, m, d } = civil(iso);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}
