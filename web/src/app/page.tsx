import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  actorOrNull, budgetFor, inboxCount, monthTotals, peopleFor, schedulesFor, setupProgress,
} from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { outstandingDues } from '@/lib/recur';
import { headerBg } from './auth-ui';
import { Icon } from './Icon';
import GettingStarted from './GettingStarted';
import MonthSoFar from './MonthSoFar';
import TabBar from './TabBar';
import { TAB_BAR_SPACE } from './tabs';
import Screen from './Screen';

export const dynamic = 'force-dynamic';

const ROLE = { owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer' } as const;

/* Home answers one question — how is this month going — and then gets out of
   the way. Everything else is a way to somewhere else, so it is small, and the
   setup checklist is one line rather than the tall card that used to push the
   answer below the fold. */
export default async function Home() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const name = actor.household_name;
  const month = monthKey(new Date());
  const [progress, totals, rows, people, inbox, schedules] = await Promise.all([
    setupProgress(actor.household_id),
    monthTotals(actor.household_id, month),
    budgetFor(actor.household_id, month),
    peopleFor(actor.household_id),
    inboxCount(actor.household_id),
    schedulesFor(actor.household_id),
  ]);

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  const dues = outstandingDues(schedules, new Date(), 7).length;
  const needsYou = inbox.duplicates + inbox.bills + dues;
  const lent = people.reduce((n, p) => n + Number(p.balance), 0);
  const monthName = new Date(month).toLocaleDateString('en-IN', { month: 'long' });

  return (
    <Screen>
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        {/* The header is the door to Settings. Where every app keeps it — your
            name and picture at the top, a cog at the far end — because "where
            do I manage my household" was being answered by a tile at the
            bottom of the grid, wearing the same icon as Lending. */}
        <header className="el2" style={{
          background: headerBg('teal'), color: '#fff', borderRadius: '0 0 26px 26px',
          padding: '12px var(--gutter) 16px',
        }}>
          <Link href="/household" transitionTypes={['nav-forward']} className="press"
            aria-label="Household and settings" style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 50,
              textDecoration: 'none', color: '#fff', borderRadius: 14,
            }}>
            <span style={{
              width: 38, height: 38, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--step--1)', fontWeight: 700,
              background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)',
            }}>{(actor.user_name || '?').slice(0, 2).toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <h1 style={{
                fontSize: 'var(--step-1)', fontWeight: 600, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em',
              }}>{name}</h1>
              <span style={{ fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.72)' }}>
                {actor.user_name} · {actor.role ? ROLE[actor.role] : ''}
              </span>
            </span>
            <span aria-hidden style={{
              width: 44, height: 44, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
              background: 'rgba(255,255,255,.12)',
            }}>
              <Icon name="settings" size={21} strokeWidth={1.9} />
            </span>
          </Link>
        </header>

        <div style={{ padding: '18px var(--gutter) 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* The answer first. */}
          {budget > 0
            ? <MonthSoFar month={month} rows={rows} budget={budget} spent={spent} />
            : <NoBudgetYet monthName={monthName} spent={spent} entries={progress.entries} />}

          {/* Then anything that actually wants a decision. */}
          {needsYou > 0 && (
            <Link transitionTypes={['nav-forward']} href="/inbox" className="el" style={{
              minHeight: 62, borderRadius: 15, display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 var(--pad)', textDecoration: 'none', background: 'var(--c-warn-tint)',
              border: '1px solid var(--c-warn-fill)', color: 'var(--c-ink)',
            }}>
              <span style={{
                width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--c-warn-fill)', color: 'var(--c-on-fill)',
              }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3.5 12.5h4l1.5 3h6l1.5-3h4" />
                  <path d="M5.5 6.5h13l2 6v5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 17.5v-5z" />
                </svg>
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                  {needsYou} {needsYou === 1 ? 'thing' : 'things'} to look at
                </span>
                <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-warn)' }}>
                  {[dues > 0 ? `${dues} due now` : null,
                    inbox.bills > 0 ? `${inbox.bills} card ${inbox.bills === 1 ? 'bill' : 'bills'}` : null,
                    inbox.duplicates > 0 ? `${inbox.duplicates} possible ${inbox.duplicates === 1 ? 'duplicate' : 'duplicates'}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-warn)"
                strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
            </Link>
          )}

          {/* Setting up is one line, and only until it is done. */}
          <GettingStarted progress={{ ...progress, budget }} />

          {/* Everywhere else, as a grid: five destinations scan faster in two
              columns than they read as five identical stacked rows. */}
          <nav aria-label="More" style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 2,
          }}>
            <Tile href="/trends" icon="invest" tint="green" label="Trends" note="Six months" />
            <Tile href="/worth" icon="vault" tint="cyan" label="Net worth" note="What it adds to" />
            <Tile href="/schedules" icon="autodebit" tint="indigo" label="Scheduled"
              note={schedules.length ? `${schedules.length} set` : 'Rent, fees, EMIs'} />
            <Tile href="/people" icon="person" tint="purple" label="Lending"
              note={lent !== 0 ? format(Math.abs(lent)) : 'Who owes what'} />
            <Tile href="/household" icon="settings" tint="blue" label="Household & settings"
              note={`${progress.members} ${progress.members === 1 ? 'member' : 'members'}`} />
            <Tile href="/guide" icon="book" tint="neutral" label="How it works" note="A walkthrough" />
          </nav>
        </div>
        <TabBar current="/" />
      </main>
    </Screen>
  );
}

/* Without a budget there is still something true to say, and saying it beats
   an empty space with a prompt in it. */
function NoBudgetYet({ monthName, spent, entries }: {
  monthName: string; spent: number; entries: number;
}) {
  return (
    <section className="el" style={{
      background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10,
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
        background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
      }}>Set this month&rsquo;s budget</Link>
    </section>
  );
}

function Tile({ href, icon, tint, label, note }: {
  href: string; icon: string; tint: string; label: string; note: string;
}) {
  return (
    <Link transitionTypes={['nav-forward']} href={href} className="el press" style={{
      minHeight: 92, borderRadius: 16, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', gap: 8, padding: '12px 13px', textDecoration: 'none',
      background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        background: `var(--cat-${tint})`, color: `var(--cat-${tint}-ink)`,
      }}>
        <Icon name={icon} size={17} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{label}</span>
        <span style={{
          fontSize: 'var(--step--2)', color: 'var(--c-meta)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{note}</span>
      </span>
    </Link>
  );
}
