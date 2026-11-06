import { Chip, Icon, ACCOUNT_ICON, ACCOUNT_TINT } from '../Icon';
import { redirect } from 'next/navigation';
import { actorOrNull, allBalances, monthlySeries, owedByPerson, tabHeldOwed, worthSeries } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { netWorth } from '@/lib/worth';
import { format } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import Screen from '../Screen';
import Link from '@/app/NavLink';
import PageHead, { Label } from '../PageHead';

export const metadata = { title: 'Net worth · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const GROUP = {
  spending: 'Bank', cash: 'Cash', savings: 'Savings', credit: 'Cards', person: 'People',
} as Record<string, string>;

export default async function Worth() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const hh = actor.household_id;
  const [accounts, owed, allSeries, held, months] = await withHousehold(hh, () => Promise.all([
    allBalances(hh),
    owedByPerson(hh),
    worthSeries(hh, 6),
    tabHeldOwed(hh),
    monthlySeries(hh, 6),
  ]));
  /* The line starts at the first month anything was recorded: before that the figure is only the opening
     balances, and "more than six months ago" would be measuring against months the books were not kept. */
  const startAt = Math.max(0, months.findIndex((m) => m.entries > 0));
  const series = allSeries.slice(startAt);

  /* Three figures, and the headline is their sum.

     Held: every account that is yours — bank, cash, savings — less the cards,
     which are money already spent. Owed to you: loans handed to people, and
     shares of costs you covered that are still outstanding. Both are yours;
     one of them is simply in someone else's pocket for now, and a household
     that has lent a lot should see that as a line, not have it folded in
     silently. */
  // Plus what the tabs are owed with nobody named — no person's row carries it.
  const { worth, assets, debts, assetTotal, debtTotal, receivable, claims, savings, lent } =
    netWorth({ accounts, claimed: owed.reduce((n, o) => n + Number(o.claimed), 0), held: Number(held) });

  const points = series.map((p) => Number(p.held));
  const lo = Math.min(...points, 0), hi = Math.max(...points, 1);
  const first = points[0], last = points[points.length - 1];
  const since = series.length ? new Date(series[0].month).toLocaleDateString('en-IN', { month: 'long' }) : 'the start';

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead title="Wealth" sub={actor.household_name} />

        <section aria-label="Net worth" className="mx-[var(--gutter)] flex flex-col gap-3 rounded-[22px] border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Net worth</span>
          <span className="font-display text-[40px] leading-none tabular-nums" style={worth < 0 ? { color: 'var(--destructive)' } : undefined}>
            {format(worth)}
          </span>
          <p className="text-sm text-muted-foreground">What you hold, plus what people owe you, less what you owe.</p>
          <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
            <Figure label="Held" value={assetTotal} />
            <Figure label="Owed to you" value={receivable} />
            <Figure label="You owe" value={debtTotal} negative />
          </dl>
        </section>

        <Link href="/accounts" transitionTypes={['nav-forward']}
          className="mx-[var(--gutter)] mt-5 flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card px-4 text-sm font-medium">
          Accounts
          <Icon name="chevron_right" size={17} className="text-muted-foreground" />
        </Link>

        <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {savings !== 0 && (
            <section className="border border-border" style={{
              margin: '0 var(--gutter)', background: 'var(--card)', borderRadius: 18, padding: 16,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <Chip icon={ACCOUNT_ICON.savings} tint={ACCOUNT_TINT.savings} size={44} radius={12} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>In savings</span>
                <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--muted-foreground)' }}>
                  Outside the monthly budget. Moving money here is not spending it.
                </span>
              </span>
              <span className="t" style={{ fontSize: 'var(--step-2)' }}>{format(savings)}</span>
            </section>
          )}

          <Section title="Held in accounts, month by month">
            <Sparkline points={points} lo={lo} hi={hi} months={series.map((p) => p.month)} />
            <p style={{
              margin: '12px 0 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)',
            }}>
              {first === last
                ? `Level since ${since}.`
                : last > first
                  ? `${format(last - first)} more than in ${since}.`
                  : `${format(first - last)} less than in ${since}.`}
              {receivable !== 0 && ' Your own accounts only — what people owe you is in the figure above but not in this line.'}
            </p>
          </Section>

          <Section title="What you have">
            <Rows rows={[
              ...assets.map((a) => ({
                key: a.id,
                label: a.name,
                note: GROUP[a.kind] ?? a.kind,
                value: Number(a.balance),
                icon: ACCOUNT_ICON[a.kind] ?? 'tag',
                tint: ACCOUNT_TINT[a.kind] ?? 'neutral',
              })),
            ]} total={assetTotal} />
          </Section>

          {receivable !== 0 && (
            <Section title="Owed to you">
              <Rows rows={[
                ...lent.map((a) => ({
                  key: a.id, label: a.name, note: 'Lent', value: Number(a.balance),
                  icon: 'person', tint: 'indigo',
                })),
                ...(claims > 0 ? [{
                  key: 'claims', label: 'Shares of costs you covered', note: 'Tabs and shared costs',
                  value: claims, icon: 'receivable', tint: 'purple',
                }] : []),
              ]} total={receivable} />
              <p style={{
                margin: '12px 0 0', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--muted-foreground)',
              }}>
                Counted in your net worth: it is your money, in someone else&apos;s pocket for now.
                Settle up in the Loan centre.
              </p>
            </Section>
          )}

          {debts.length > 0 && (
            <Section title="What you owe">
              <Rows rows={debts.map((a) => ({
                key: a.id,
                label: a.name + (a.last4 ? ` · ${a.last4}` : ''),
                note: GROUP[a.kind] ?? a.kind,
                value: Number(a.balance),
                icon: ACCOUNT_ICON[a.kind] ?? 'card',
                tint: ACCOUNT_TINT[a.kind] ?? 'orange',
              }))} total={debtTotal} negative />
            </Section>
          )}
        </div>
        <TabBar current="/worth" />
      </main>
    </Screen>
  );
}

/* One of the three figures under the headline, as a small stat with its own
   label so a glance separates cash in hand from cash in a cousin's pocket. */
function Figure({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums" style={negative && value !== 0 ? { color: 'var(--destructive)' } : undefined}>
        {format(Math.abs(value))}
      </dd>
    </div>
  );
}

/* A single line, drawn from the numbers rather than a library, with the figures
   written underneath it. The shape is the quick read; the words are the record. */
function Sparkline({ points, lo, hi, months }: {
  points: number[]; lo: number; hi: number; months: string[];
}) {
  const W = 320, H = 90, PAD = 6;
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const zero = lo < 0 && hi > 0 ? y(0) : null;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Held in accounts. ${months.map((m, i) =>
          `${new Date(m).toLocaleDateString('en-IN', { month: 'short' })} ${format(points[i])}`).join(', ')}`}
        style={{ display: 'block', overflow: 'visible' }}>
        {zero !== null && (
          <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--input)"
            strokeWidth={1} strokeDasharray="3 3" />
        )}
        <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={2.4}
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? 'var(--chart-1)' : 'var(--card)'}
            stroke="var(--chart-1)" strokeWidth={1.6} />
        ))}
      </svg>
      <ul style={{
        display: 'flex', justifyContent: 'space-between', margin: '8px 0 0', padding: 0,
        listStyle: 'none', fontSize: 'var(--step--2)', color: 'var(--muted-foreground)',
      }}>
        {months.map((m) => (
          <li key={m}>{new Date(m).toLocaleDateString('en-IN', { month: 'short' })}</li>
        ))}
      </ul>
    </figure>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-[var(--gutter)] flex flex-col gap-2">
      <Label>{title}</Label>
      <div className="rounded-2xl border border-border bg-card p-4">{children}</div>
    </section>
  );
}

function Rows({ rows, total, negative }: {
  rows: { key: string; label: string; note: string; value: number;
          icon: string; tint: string }[];
  total: number; negative?: boolean;
}) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
      {rows.map((r, i) => (
        <li key={r.key} style={{
          display: 'flex', alignItems: 'center', gap: 12, minHeight: 54,
          borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--border)',
        }}>
          <Chip icon={r.icon} tint={r.tint} size={34} radius={9} iconSize={17} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>{r.note}</span>
          </span>
          <span className="t amt" style={{
            fontSize: 'var(--step-0)', color: negative ? 'var(--destructive)' : 'var(--foreground)',
          }}>{format(Math.abs(r.value))}</span>
        </li>
      ))}
      <li style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 50,
        borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6,
      }}>
        <span style={{ flex: 1, fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>Total</span>
        <span className="t" style={{
          fontSize: 'var(--step-2)', color: negative ? 'var(--destructive)' : 'var(--foreground)',
        }}>{format(Math.abs(total))}</span>
      </li>
    </ul>
  );
}
