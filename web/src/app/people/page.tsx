import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, claimsFor, peopleFor, receiptsByMonth, tabList, type TabRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import NewTab from '../tab/NewTab';
import { Chip, Icon } from '../Icon';
import Screen from '../Screen';
import Back from '../Back';
import Swipeable from '../Swipeable';
import { Face, Faces, tabTint } from '../tab/look';

export const metadata = { title: 'Loan centre · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* The Loan centre is a list of tabs, and nothing else asks to be managed.

   A tab is a folder: a trip, the office, a cousin's rent. It holds what you
   put down and what came back, it has a name if you give it one, and the
   people on it are optional labels picked from the phone book. There used to
   be a People list here as well, with its own Add person — a second thing to
   keep for no gain, since every person worth listing is on a tab. They are
   still in the books underneath (a claim needs somebody to owe it), and a
   loan made outside any tab still shows, in its own short section, so no
   money owed ever drops off this screen.

   "Owed to you" here is the same figure as Home's card: every open claim — a
   tab's own included — plus what people hold of money lent. */
export default async function LoanCentre() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const hh = actor.household_id;
  const [tabs, people, claims, receipts] = await withHousehold(hh, () => Promise.all([
    tabList(hh),
    peopleFor(hh),
    claimsFor(hh),
    receiptsByMonth(hh, 1),
  ]));
  const canWrite = actor.role !== 'viewer';

  const onClaims = claims
    .filter((c) => c.status === 'open' || c.status === 'part_paid')
    .reduce((n, c) => n + Number(c.outstanding), 0);
  const lent = people.filter((p) => Number(p.balance) !== 0);
  const lentOut = lent.reduce((n, p) => n + Math.max(0, Number(p.balance)), 0);
  const youOwe = lent.reduce((n, p) => n - Math.min(0, Number(p.balance)), 0);
  const owed = onClaims + lentOut;
  const backThisMonth = Number(receipts[0]?.back ?? 0);

  /* A tab stays in the open list while anything is owed on it, or while it is
     new and empty; settled and closed tabs fold away underneath. */
  const open = tabs.filter((t) => !t.closed_at && (Number(t.outstanding) > 0 || t.costs === 0));
  const done = tabs.filter((t) => !open.includes(t));
  const month = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <Screen>
      <Back to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('purple'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 12,
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
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            Loan centre
          </h1>
          <div style={{ display: 'flex', gap: 24, marginTop: 2 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                OWED TO YOU
              </span>
              <span className="t" style={{ fontSize: 'var(--step-4)', letterSpacing: '-.022em' }}>
                {format(owed)}
              </span>
            </span>
            {youOwe > 0 && (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                  YOU OWE
                </span>
                <span className="t" style={{ fontSize: 'var(--step-2)', letterSpacing: '-.02em' }}>
                  {format(youOwe)}
                </span>
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'rgba(255,255,255,.78)' }}>
            {tabs.length === 0
              ? 'A tab keeps what you put down for others — a trip, the office, a cousin — and what comes back.'
              : [
                  `across ${open.length} open ${open.length === 1 ? 'tab' : 'tabs'}`,
                  backThisMonth > 0 ? `${format(backThisMonth)} came back in ${month}` : null,
                ].filter(Boolean).join(' · ')}
          </p>
        </header>

        <div style={{ paddingTop: 20 }}>
          {open.length > 0 && (
            <>
              <Head>Open tabs</Head>
              <section className="el card" style={{
                margin: '0 var(--gutter) 14px', background: 'var(--c-card)', borderRadius: 18,
                padding: '0 var(--pad)', overflow: 'hidden',
              }}>
                {open.map((t, i) => (
                  <TabItem key={t.id} t={t} last={i === open.length - 1} canWrite={canWrite} />
                ))}
              </section>
            </>
          )}

          {canWrite && <NewTab />}

          {done.length > 0 && (
            <details className="el card" style={{
              margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18,
              padding: '0 var(--pad)', overflow: 'hidden',
            }}>
              <summary style={{
                listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60,
                cursor: 'pointer', color: 'var(--c-meta)',
              }}>
                <span style={{
                  width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: 'var(--c-sunk)', color: 'var(--c-faint)',
                }}><Icon name="check" size={19} strokeWidth={2.2} /></span>
                <span style={{ flex: 1, fontSize: 'var(--step-0)', fontWeight: 500 }}>
                  {done.length} settled or closed {done.length === 1 ? 'tab' : 'tabs'}
                </span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div style={{ borderTop: '1px solid var(--c-rule)' }}>
                {done.map((t, i) => (
                  <TabItem key={t.id} t={t} last={i === done.length - 1} canWrite={false} quiet />
                ))}
              </div>
            </details>
          )}

          {/* Money handed to someone outside any tab — the older khata. Only
              shown when there is some, so it never asks to be managed. */}
          {lent.length > 0 && (
            <>
              <Head>Lent outside a tab</Head>
              <section className="el card" style={{
                margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
              }}>
                {lent.map((p, i) => {
                  const bal = Number(p.balance);
                  return (
                    <Link key={p.id} href={`/people/${p.id}`} transitionTypes={['nav-forward']} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 66,
                      textDecoration: 'none', color: 'var(--c-ink)',
                      borderBottom: i === lent.length - 1 ? undefined : '1px solid var(--c-rule)',
                    }}>
                      <Face name={p.name} tint={p.tint} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--step-0)', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="t" style={{ fontSize: 'var(--step-1)', color: bal < 0 ? 'var(--c-out)' : 'var(--c-ink)' }}>
                          {format(Math.abs(bal))}
                        </span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                          {bal > 0 ? 'owes you' : 'you owe'}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </section>
            </>
          )}
        </div>
        <TabBar current="/people" />
      </main>
    </Screen>
  );
}

/* One tab: its colour, who is on it, what is still owed and how much of it has
   come back. Swipe for Remind and Add cost — both also a tap away inside. */
function TabItem({ t, last, canWrite, quiet = false }: {
  t: TabRow; last: boolean; canWrite: boolean; quiet?: boolean;
}) {
  const outstanding = Number(t.outstanding);
  const inAll = Number(t.owed_in_all);
  const back = Number(t.back);
  const pct = inAll > 0 ? Math.min(100, Math.round((back / inAll) * 100)) : 0;
  const actions = canWrite && !t.closed_at ? [
    ...(outstanding > 0 ? [{ label: 'Remind', icon: 'bell', tone: 'neutral' as const, href: `/tab/${t.id}?remind=all` }] : []),
    { label: 'Add cost', icon: 'plus', tone: 'primary' as const, href: `/add?tab=${t.id}` },
  ] : [];

  return (
    <Swipeable actions={actions} commit={false}>
      <Link href={`/tab/${t.id}`} transitionTypes={['nav-forward']} draggable={false} style={{
        display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0 13px',
        textDecoration: 'none', color: 'var(--c-ink)', opacity: quiet ? 0.72 : 1,
        borderBottom: last ? undefined : '1px solid var(--c-rule)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Chip icon="folder" tint={tabTint(t.id)} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{
              fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{t.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              <Faces people={t.members} />
              <span>
                {t.members.length === 0 ? '· ' : ''}
                {t.costs === 0 ? 'nothing on it yet' : `${t.costs} ${t.costs === 1 ? 'cost' : 'costs'}`}
                {t.closed_at ? ' · closed' : ''}
              </span>
            </span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
            <span className="t" style={{
              fontSize: 'var(--step-1)', color: outstanding === 0 ? 'var(--c-meta)' : 'var(--c-ink)',
            }}>{outstanding === 0 ? (t.costs > 0 ? 'settled' : '—') : format(outstanding)}</span>
            {inAll > 0 && (
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                {back > 0 ? `${format(back)} back` : 'none back yet'}
              </span>
            )}
          </span>
        </span>
        {inAll > 0 && outstanding > 0 && (
          <span role="img" aria-label={`${pct}% come back`} style={{
            marginLeft: 52, height: 4, borderRadius: 999, background: 'var(--c-track)', overflow: 'hidden', display: 'block',
          }}>
            <span style={{
              display: 'block', width: `${pct}%`, height: 4, borderRadius: 999, background: 'var(--c-seagrass)',
            }} />
          </span>
        )}
      </Link>
    </Swipeable>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}
