import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, entriesFor, inboxCount, monthTotals, schedulesFor, setupProgress } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format, monthKey } from '@/lib/money';
import { outstandingDues, ruleOf } from '@/lib/recur';
import DueRow from './schedules/DueRow';
import { Chip } from './Icon';
import GettingStarted from './GettingStarted';
import MonthRing from './home/MonthRing';
import TabBar from './TabBar';
import { TAB_BAR_SPACE } from './tabs';
import Screen from './Screen';
import SavedSnack from './SavedSnack';

export const dynamic = 'force-dynamic';

/* Home answers one question — how is this month going — and then gets out of
   the way. Everything else is a way to somewhere else, so it is small, and the
   setup checklist is one line rather than the tall card that used to push the
   answer below the fold. */
export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { saved } = await searchParams;
  const name = actor.household_name;
  const month = monthKey(new Date());
  const hh = actor.household_id;
  /* Home asks only what it shows. Net worth, loans and tabs moved to Money, and the per-category budget to Plan. */
  const [progress, totals, inbox, schedules, recent] = await withHousehold(hh, () => Promise.all([
    setupProgress(hh),
    monthTotals(hh, month),
    inboxCount(hh),
    schedulesFor(hh),
    entriesFor(hh, month),
  ]));

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  /* What is due today — or should have been already — is asked about here,
     on the screen the household opens first: is it paid, or has it moved?
     What is due later in the week is only counted, and waits in the inbox. */
  const now = new Date();
  const todayIso = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const allDues = outstandingDues(schedules, now, 7);
  const canAct = actor.role !== 'viewer';
  const dueNow = canAct ? allDues.filter((d) => d.daysAway <= 0) : [];
  const dues = allDues.length - dueNow.length;
  const needsYou = inbox.duplicates + inbox.bills + dues;
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const monthName = new Date(month).toLocaleDateString('en-IN', { month: 'long' });

  const todays = recent.filter((e) => String(e.occurred_on).slice(0, 10) === todayIso);
  const latest = todays.length ? todays : recent.slice(0, 5);
  const dueSoon = allDues.filter((d) => d.daysAway > 0);
  const dueSoonTotal = dueSoon.reduce((n, d) => n + Number(byId.get(d.scheduleId)?.amount ?? 0), 0);

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        {/* Quiet Ledger: no dark header. The month and the household, and your initials at the far end — the door to
            household and settings, where people look for them. */}
        <header className="flex items-center gap-3 px-[var(--gutter)] pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
            <h1 className="truncate font-display text-[28px] leading-tight">{name}</h1>
          </div>
          <Link href="/household" transitionTypes={['nav-forward']} aria-label="Household and settings"
            className="press grid size-11 flex-none place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
            {(actor.user_name || '?').slice(0, 2).toUpperCase()}
          </Link>
        </header>

        <div className="flex flex-col gap-3.5 px-[var(--gutter)] pt-2">
          {budget > 0
            ? <MonthRing month={month} budget={budget} spent={spent} />
            : <NoBudgetYet monthName={monthName} spent={spent} entries={progress.entries} />}

          {/* What needs you: decisions waiting, and what's due in the coming week. Nothing else. */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/inbox" transitionTypes={['nav-forward']}
              className={`press flex min-h-[72px] flex-col justify-center gap-0.5 rounded-2xl border px-3.5 ${needsYou > 0
                ? 'border-attention/40 bg-attention-soft text-attention-soft-foreground' : 'border-border bg-card'}`}>
              <span className="text-xs opacity-80">Needs you</span>
              <span className="text-base font-semibold">{needsYou > 0 ? `${needsYou} to look at` : 'All clear'}</span>
            </Link>
            <Link href="/schedules" transitionTypes={['nav-forward']}
              className="press flex min-h-[72px] flex-col justify-center gap-0.5 rounded-2xl border border-border bg-card px-3.5">
              <span className="text-xs text-muted-foreground">Due this week</span>
              <span className="text-base font-semibold tabular-nums">{dueSoon.length ? format(dueSoonTotal) : 'Nothing'}</span>
            </Link>
          </div>

          {dueNow.length > 0 && (
            <section aria-label="Due today" className="rounded-2xl border border-border bg-card px-[var(--pad)]">
              <h2 className="pb-0.5 pt-3 text-sm font-semibold">{dueNow.some((d) => d.daysAway < 0) ? 'Due now' : 'Due today'}</h2>
              {dueNow.map((d) => {
                const s = byId.get(d.scheduleId)!;
                return (
                  <DueRow key={`${d.scheduleId}:${d.dueOn}`}
                    scheduleId={d.scheduleId} name={s.name} kind={s.kind} dueOn={d.dueOn}
                    on={d.on} movedFrom={d.movedFrom} daysAway={d.daysAway}
                    amount={Number(s.amount ?? 0)} category={s.category} icon={s.icon} tint={s.tint}
                    rule={ruleOf(s)?.rule} cal={ruleOf(s)?.cal} today={todayIso} />
                );
              })}
            </section>
          )}

          <GettingStarted progress={{ ...progress, budget }} />

          {latest.length > 0 && (
            <section aria-label={todays.length ? 'Today' : 'Latest'} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{todays.length ? 'Today' : 'Latest'}</h2>
                <Link href="/entries" transitionTypes={['nav-lateral']} className="text-sm font-medium text-primary">See all</Link>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {latest.map((e) => <EntryLine key={e.id} e={e} />)}
              </ul>
            </section>
          )}

          <Link href="/guide" transitionTypes={['nav-forward']} className="self-center py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
            How the app works
          </Link>
        </div>
        {saved && /^[0-9a-f-]{36}$/.test(saved) && <SavedSnack id={saved} />}
        <TabBar current="/" />
      </main>
    </Screen>
  );
}

/* One entry, as every list in the app will draw it: its category chip, where the money went (or came from), what it
   was filed under, and the figure in the colour of its direction. A move between your own accounts is neither. */
function EntryLine({ e }: { e: Awaited<ReturnType<typeof entriesFor>>[number] }) {
  const out = e.kind === 'expense';
  const into = e.kind === 'income' || e.kind === 'claim_receipt' || e.kind === 'refund';
  const title = e.merchant || e.category || (e.kind === 'card_payment' ? 'Card payment' : e.kind === 'transfer' ? 'Transfer' : 'Entry');
  const sub = e.kind === 'card_payment' || e.kind === 'transfer'
    ? [e.account, e.counter_account].filter(Boolean).join(' → ')
    : [e.category, e.method ?? e.account].filter(Boolean).join(' · ');
  return (
    <li>
      <Link href={`/entries/${e.id}`} transitionTypes={['nav-forward']} className="press flex min-h-[56px] items-center gap-3 px-3.5 py-2">
        <Chip icon={e.icon ?? (e.kind === 'card_payment' ? 'card' : e.kind === 'transfer' ? 'transfer' : 'tag')} tint={e.tint ?? 'neutral'} size={34} radius={10} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-medium">{title}</span>
          <span className="truncate text-xs text-muted-foreground">{sub}{e.is_shared ? ' · Shared' : ''}</span>
        </span>
        <span className={`flex-none text-[15px] font-semibold tabular-nums ${out ? 'text-money-out' : into ? 'text-money-in' : ''}`}>
          {out ? '−' : into ? '+' : ''}{format(Number(e.amount))}
        </span>
      </Link>
    </li>
  );
}

/* Without a budget there is still something true to say, and saying it beats
   an empty space with a prompt in it. */
function NoBudgetYet({ monthName, spent, entries }: {
  monthName: string; spent: number; entries: number;
}) {
  return (
    <section className="el2 hero" style={{
      borderRadius: 22, padding: '18px 17px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>{monthName} so far</h2>
      <span className="t" style={{ fontSize: 'var(--step-4)', lineHeight: 1 }}>{format(spent)}</span>
      <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
        {entries === 0
          ? 'Nothing recorded yet.'
          : `Across ${entries} ${entries === 1 ? 'entry' : 'entries'}. Set a budget and this gets something to measure against.`}
      </p>
      <Link transitionTypes={['nav-lateral']} href="/budget" style={{
        minHeight: 48, borderRadius: 13, display: 'flex', alignItems: 'center',
        justifyContent: 'center', textDecoration: 'none',
        fontSize: 'var(--step-0)', fontWeight: 600,
        background: 'var(--g-primary)', color: 'var(--c-on-primary)',
      }}>Create a budget</Link>
    </section>
  );
}
