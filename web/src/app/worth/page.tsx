import Link from 'next/link';
import { Chip, ACCOUNT_ICON, ACCOUNT_TINT } from '../Icon';
import { redirect } from 'next/navigation';
import { actorOrNull, allBalances, owedByPerson, worthSeries } from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import Screen from '../Screen';
import Back from '../Back';

export const metadata = { title: 'Net worth · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const GROUP = {
  spending: 'Bank', cash: 'Cash', savings: 'Savings', credit: 'Cards', person: 'People',
} as Record<string, string>;

export default async function Worth() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const [accounts, owed, series] = await Promise.all([
    allBalances(actor.household_id),
    owedByPerson(actor.household_id),
    worthSeries(actor.household_id, 6),
  ]);

  /* Three figures, and the headline is their sum.

     Held: every account that is yours — bank, cash, savings — less the cards,
     which are money already spent. Owed to you: loans handed to people, and
     shares of costs you covered that are still outstanding. Both are yours;
     one of them is simply in someone else's pocket for now, and a household
     that has lent a lot should see that as a line, not have it folded in
     silently. */
  const claims = owed.reduce((n, o) => n + Number(o.claimed), 0);
  const own = accounts.filter((a) => a.kind !== 'person');
  const people = accounts.filter((a) => a.kind === 'person');
  const lent = people.filter((a) => Number(a.balance) > 0);
  const borrowed = people.filter((a) => Number(a.balance) < 0);

  const assets = own.filter((a) => Number(a.balance) > 0);
  const debts = [...own.filter((a) => Number(a.balance) < 0), ...borrowed];
  const assetTotal = assets.reduce((n, a) => n + Number(a.balance), 0);
  const debtTotal = debts.reduce((n, a) => n + Number(a.balance), 0);
  const receivable = lent.reduce((n, a) => n + Number(a.balance), 0) + claims;
  const worth = assetTotal + receivable + debtTotal;
  const savings = own
    .filter((a) => a.kind === 'savings')
    .reduce((n, a) => n + Number(a.balance), 0);

  const points = series.map((p) => Number(p.held));
  const lo = Math.min(...points, 0), hi = Math.max(...points, 1);
  const first = points[0], last = points[points.length - 1];

  return (
    <Screen>
      <Back to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('green'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{
              fontSize: 'var(--step--2)', fontWeight: 600, letterSpacing: '.05em',
              color: 'rgba(255,255,255,.66)',
            }}>NET WORTH</span>
            <span className="t" style={{
              fontSize: 'var(--step-4)', letterSpacing: '-.024em', lineHeight: 1,
              color: worth < 0 ? 'var(--c-danger-fill)' : '#fff',
            }}>{format(worth)}</span>
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            What you hold, plus what people owe you, less what you owe.
          </p>
          <dl style={{
            margin: '4px 0 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          }}>
            <Figure label="Held" value={assetTotal} />
            <Figure label="Owed to you" value={receivable} />
            <Figure label="You owe" value={debtTotal} negative />
          </dl>
        </header>

        <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {savings !== 0 && (
            <section className="el card" style={{
              margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: 16,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <Chip icon={ACCOUNT_ICON.savings} tint={ACCOUNT_TINT.savings} size={44} radius={12} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>In savings</span>
                <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
                  Outside the monthly budget. Moving money here is not spending it.
                </span>
              </span>
              <span className="t" style={{ fontSize: 'var(--step-2)' }}>{format(savings)}</span>
            </section>
          )}

          <Section title="Held in accounts, month by month">
            <Sparkline points={points} lo={lo} hi={hi} months={series.map((p) => p.month)} />
            <p style={{
              margin: '12px 0 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
            }}>
              {first === last
                ? 'Level over the last six months.'
                : last > first
                  ? `${format(last - first)} more than six months ago.`
                  : `${format(first - last)} less than six months ago.`}
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
                margin: '12px 0 0', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--c-meta)',
              }}>
                Counted in your net worth: it is your money, in someone else&apos;s pocket for now.
                Settle up under Lending.
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
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 11px', borderRadius: 12,
      background: 'rgba(255,255,255,.12)', minWidth: 0,
    }}>
      <dt style={{
        fontSize: 'var(--step--2)', fontWeight: 600, letterSpacing: '.03em',
        color: 'rgba(255,255,255,.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</dt>
      <dd className="t" style={{
        margin: 0, fontSize: 'var(--step-0)', letterSpacing: '-.01em',
        color: negative && value !== 0 ? 'var(--c-danger-fill)' : '#fff',
      }}>{format(Math.abs(value))}</dd>
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
          <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--c-dash)"
            strokeWidth={1} strokeDasharray="3 3" />
        )}
        <path d={d} fill="none" stroke="var(--c-seagrass)" strokeWidth={2.4}
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? 'var(--c-seagrass)' : 'var(--c-card)'}
            stroke="var(--c-seagrass)" strokeWidth={1.6} />
        ))}
      </svg>
      <ul style={{
        display: 'flex', justifyContent: 'space-between', margin: '8px 0 0', padding: 0,
        listStyle: 'none', fontSize: 'var(--step--2)', color: 'var(--c-meta)',
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
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--gutter) 11px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
          {title}
        </h2>
        <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      </div>
      <div className="el card" style={{
        margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      }}>{children}</div>
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
          borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--c-rule)',
        }}>
          <Chip icon={r.icon} tint={r.tint} size={34} radius={9} iconSize={17} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{r.note}</span>
          </span>
          <span className="t amt" style={{
            fontSize: 'var(--step-0)', color: negative ? 'var(--c-danger)' : 'var(--c-ink)',
          }}>{format(Math.abs(r.value))}</span>
        </li>
      ))}
      <li style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 50,
        borderTop: '1px solid var(--c-border)', marginTop: 6, paddingTop: 6,
      }}>
        <span style={{ flex: 1, fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Total</span>
        <span className="t" style={{
          fontSize: 'var(--step-2)', color: negative ? 'var(--c-danger)' : 'var(--c-ink)',
        }}>{format(Math.abs(total))}</span>
      </li>
    </ul>
  );
}
