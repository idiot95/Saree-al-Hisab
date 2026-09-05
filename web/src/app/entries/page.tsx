import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, budgetFor, entriesFor } from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { HEADER_BG } from '../auth-ui';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';

export const metadata = { title: 'Entries · Quiet Ledger' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const monthLabel = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shift = (m: string, by: number) => {
  const d = new Date(m);
  return monthKey(new Date(d.getFullYear(), d.getMonth() + by, 1));
};

const TINT: Record<string, [string, string]> = {
  green: ['var(--cat-green)', 'var(--cat-green-ink)'],
  orange: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  blue: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
  pink: ['var(--cat-pink)', 'var(--cat-pink-ink)'],
  cyan: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
  rust: ['var(--cat-rust)', 'var(--cat-rust-ink)'],
  indigo: ['var(--cat-indigo)', 'var(--cat-indigo-ink)'],
};

const MOVES = new Set(['transfer', 'card_payment']);
const INCOMING = new Set(['income', 'claim_receipt', 'refund']);

export default async function Entries({ searchParams }: {
  searchParams: Promise<{ m?: string; c?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { m, c } = await searchParams;
  const month = m && MONTH.test(m) ? m : monthKey(new Date());
  const categoryId = c && /^[0-9a-f-]{36}$/.test(c) ? c : null;

  const [entries, categories] = await Promise.all([
    entriesFor(actor.household_id, month, categoryId),
    budgetFor(actor.household_id, month),
  ]);
  const filtered = categories.find((x) => x.category_id === categoryId);

  // Grouped by day: Gestalt proximity does the work a date column would.
  const days: { on: string; rows: typeof entries }[] = [];
  for (const e of entries) {
    const key = new Date(e.occurred_on).toISOString().slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.on === key) last.rows.push(e);
    else days.push({ on: key, rows: [e] });
  }

  const spent = entries
    .filter((e) => !MOVES.has(e.kind))
    .reduce((n, e) => n + (INCOMING.has(e.kind) ? -Number(e.amount) : Number(e.amount)), 0);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/" aria-label="Back" style={iconLink}>
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
          <span style={{ fontSize: 14.5, fontWeight: 600, minWidth: 118, textAlign: 'center' }}>
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

        <h1 className="t" style={{ margin: 0, fontSize: 26, letterSpacing: '-.018em' }}>
          {filtered ? filtered.name : 'Entries'}
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.82)' }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · {format(spent)} spent
        </p>

        {filtered && (
          <Link href={`/entries?m=${month}`} style={{
            alignSelf: 'flex-start', minHeight: 36, display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 12px', borderRadius: 999, textDecoration: 'none',
            background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 13, fontWeight: 600,
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            Showing one category
          </Link>
        )}
      </header>

      {entries.length === 0 ? (
        <p style={{
          margin: '40px 34px', textAlign: 'center', fontSize: 14.5, lineHeight: 1.55,
          color: 'var(--c-meta)',
        }}>
          Nothing recorded for {monthLabel(month)}{filtered ? ` under ${filtered.name}` : ''} yet.
        </p>
      ) : (
        <div style={{ padding: '18px 0 0' }}>
          {days.map((d) => (
            <section key={d.on} style={{ marginBottom: 18 }}>
              <h2 style={{
                margin: '0 20px 8px', fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em',
                color: 'var(--c-meta)',
              }}>{dayLabel(d.on)}</h2>
              <div className="el" style={{
                margin: '0 18px', background: 'var(--c-card)', borderRadius: 16, padding: '0 14px',
              }}>
                {d.rows.map((e, i) => {
                  const [bg, ink] = TINT[e.tint ?? ''] ?? ['var(--cat-neutral)', 'var(--cat-neutral-ink)'];
                  const move = MOVES.has(e.kind);
                  const incoming = INCOMING.has(e.kind);
                  return (
                    <Link key={e.id} href={`/entries/${e.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
                      textDecoration: 'none', color: 'var(--c-ink)',
                      borderBottom: i === d.rows.length - 1 ? undefined : '1px solid var(--c-rule)',
                    }}>
                      <span style={{
                        width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                        background: move ? 'var(--c-sunk)' : bg,
                        color: move ? 'var(--c-meta)' : ink,
                      }}>
                        {move ? (
                          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M7 8h13l-3-3M17 16H4l3 3" />
                          </svg>
                        ) : (e.category ?? '··').slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{
                          fontSize: 15, fontWeight: 600, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {e.merchant || e.category || (move ? 'Transfer' : 'Entry')}
                        </span>
                        <span style={{
                          fontSize: 12, color: 'var(--c-meta)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {move && e.counter_account
                            ? `${e.account} → ${e.counter_account}`
                            : [e.category, e.method].filter(Boolean).join(' · ')}
                          {e.is_shared && ' · shared'}
                        </span>
                      </span>
                      <span className="t" style={{
                        fontSize: 16, letterSpacing: '-.01em', flex: 'none',
                        color: incoming ? 'var(--c-ok)' : move ? 'var(--c-meta)' : 'var(--c-ink)',
                      }}>
                        {incoming ? '+' : ''}{format(Number(e.amount))}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <TabBar current="/entries" />
    </main>
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
