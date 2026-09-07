import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, budgetFor, entriesFor, monthTotals } from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import Screen from '../Screen';
import Back from '../Back';
import EntryList, { type Row } from './EntryList';

export const metadata = { title: 'Entries · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const monthLabel = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shift = (m: string, by: number) => {
  const d = new Date(m);
  return monthKey(new Date(d.getFullYear(), d.getMonth() + by, 1));
};


export default async function Entries({ searchParams }: {
  searchParams: Promise<{ m?: string; c?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { m, c } = await searchParams;
  const month = m && MONTH.test(m) ? m : monthKey(new Date());
  const categoryId = c && /^[0-9a-f-]{36}$/.test(c) ? c : null;

  const [entries, categories, totals] = await Promise.all([
    entriesFor(actor.household_id, month, categoryId),
    budgetFor(actor.household_id, month),
    monthTotals(actor.household_id, month),
  ]);
  const filtered = categories.find((x) => x.category_id === categoryId);

  // Grouped by day: Gestalt proximity does the work a date column would.
  const days: { on: string; label: string; rows: Row[] }[] = [];
  for (const e of entries) {
    const key = new Date(e.occurred_on).toISOString().slice(0, 10);
    const row: Row = {
      id: e.id, kind: e.kind, amount: e.amount, merchant: e.merchant, category: e.category,
      method: e.method, account: e.account, counter_account: e.counter_account,
      icon: e.icon, tint: e.tint, is_shared: e.is_shared,
      people: e.people, to_person: e.to_person, from_person: e.from_person, settles: e.settles,
      counts_as_spend: e.counts_as_spend, book_id: e.book_id,
    };
    const last = days[days.length - 1];
    if (last && last.on === key) last.rows.push(row);
    else days.push({ on: key, label: dayLabel(key), rows: [row] });
  }

  /* What the month cost comes from spend_txn, never from adding up the rows
     on screen. A cost laid out for someone shows here as the payment that
     happened, and none of it is spending — summing the list would count it. */
  const spent = filtered ? Number(filtered.spent) : Number(totals.spent);

  return (
    <Screen>
      <Back to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('indigo'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 24px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link href="/" transitionTypes={['nav-back']} aria-label="Back" style={iconLink}>
              <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Link>
            <span style={{ flex: 1 }} />
            <Link href={`/entries?m=${shift(month, -1)}${categoryId ? `&c=${categoryId}` : ''}`}
              aria-label="Previous month" style={iconLink}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Link>
            <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, minWidth: 118, textAlign: 'center' }}>
              {monthLabel(month)}
            </span>
            <Link href={`/entries?m=${shift(month, 1)}${categoryId ? `&c=${categoryId}` : ''}`}
              aria-label="Next month" style={iconLink}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            {filtered ? filtered.name : 'Entries'}
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.82)' }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {format(spent)} spent
          </p>

          {filtered && (
            <Link href={`/entries?m=${month}`} style={{
              alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 12px', borderRadius: 999, textDecoration: 'none',
              background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 'var(--step--1)', fontWeight: 600,
            }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              Showing one category
            </Link>
          )}
        </header>

        {entries.length === 0 ? (
          <p style={{
            margin: '40px 34px', textAlign: 'center', fontSize: 'var(--step-0)', lineHeight: 1.55,
            color: 'var(--c-meta)',
          }}>
            Nothing recorded for {monthLabel(month)}{filtered ? ` under ${filtered.name}` : ''} yet.
          </p>
        ) : (
          <EntryList days={days} canEdit={actor.role !== 'viewer'} />
        )}
        <TabBar current="/entries" />
      </main>
    </Screen>
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
}

const iconLink: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 999, display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: 'rgba(255,255,255,.92)', marginLeft: -11,
};
