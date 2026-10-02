import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, claimsFor, peopleFor, receiptsByMonth, tabList, type TabRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import NewTab from '../tab/NewTab';
import { Chip, Icon } from '../Icon';
import Screen from '../Screen';
import PageHead, { Label } from '../PageHead';
import MoneyNav from '../accounts/MoneyNav';
import Swipeable from '../Swipeable';
import { Face, Faces, tabTint } from '../tab/look';

export const metadata = { title: 'Loans · Saree al-Hisab' };
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
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead title="Money" sub={actor.household_name}>
          <MoneyNav current="people" />
        </PageHead>

        <section aria-label="What is owed" className="mx-[var(--gutter)] mb-5 flex flex-col gap-3 rounded-[22px] border border-border bg-card p-4">
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Owed to you</dt>
              <dd className="truncate font-display text-[34px] leading-none tabular-nums">{format(owed)}</dd>
            </div>
            {youOwe > 0 && (
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">You owe</dt>
                <dd className="truncate font-display text-[34px] leading-none tabular-nums">{format(youOwe)}</dd>
              </div>
            )}
          </dl>
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {tabs.length === 0
              ? 'A tab keeps what you put down for others (a trip, the office, a cousin) and what comes back.'
              : [
                  `Across ${open.length} open ${open.length === 1 ? 'tab' : 'tabs'}`,
                  backThisMonth > 0 ? `${format(backThisMonth)} came back in ${month}` : null,
                ].filter(Boolean).join(' · ')}
          </p>
        </section>

        <div>
          {open.length > 0 && (
            <>
              <Head>Open tabs</Head>
              <section className="border border-border" style={{
                margin: '0 var(--gutter) 14px', background: 'var(--card)', borderRadius: 18,
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
            <details className="border border-border" style={{
              margin: '0 var(--gutter) 22px', background: 'var(--card)', borderRadius: 18,
              padding: '0 var(--pad)', overflow: 'hidden',
            }}>
              <summary style={{
                listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60,
                cursor: 'pointer', color: 'var(--muted-foreground)',
              }}>
                <span style={{
                  width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: 'var(--muted)', color: 'var(--muted-foreground)',
                }}><Icon name="check" size={19} strokeWidth={2.2} /></span>
                <span style={{ flex: 1, fontSize: 'var(--step-0)', fontWeight: 500 }}>
                  {done.length} settled or closed {done.length === 1 ? 'tab' : 'tabs'}
                </span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div style={{ borderTop: '1px solid var(--border)' }}>
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
              <section className="border border-border" style={{
                margin: '0 var(--gutter) 22px', background: 'var(--card)', borderRadius: 18, padding: '0 var(--pad)',
              }}>
                {lent.map((p, i) => {
                  const bal = Number(p.balance);
                  return (
                    <Link key={p.id} href={`/people/${p.id}`} transitionTypes={['nav-forward']} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 66,
                      textDecoration: 'none', color: 'var(--foreground)',
                      borderBottom: i === lent.length - 1 ? undefined : '1px solid var(--border)',
                    }}>
                      <Face name={p.name} tint={p.tint} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--step-0)', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="t" style={{ fontSize: 'var(--step-1)', color: bal < 0 ? 'var(--money-out)' : 'var(--foreground)' }}>
                          {format(Math.abs(bal))}
                        </span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
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
        textDecoration: 'none', color: 'var(--foreground)', opacity: quiet ? 0.72 : 1,
        borderBottom: last ? undefined : '1px solid var(--border)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Chip icon="folder" tint={tabTint(t.id)} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{
              fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{t.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
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
              fontSize: 'var(--step-1)', color: outstanding === 0 ? 'var(--muted-foreground)' : 'var(--foreground)',
            }}>{outstanding === 0 ? (t.costs > 0 ? 'settled' : '—') : format(outstanding)}</span>
            {inAll > 0 && (
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                {back > 0 ? `${format(back)} back` : 'none back yet'}
              </span>
            )}
          </span>
        </span>
        {inAll > 0 && outstanding > 0 && (
          <span role="img" aria-label={`${pct}% come back`} style={{
            marginLeft: 52, height: 4, borderRadius: 999, background: 'var(--muted)', overflow: 'hidden', display: 'block',
          }}>
            <span style={{
              display: 'block', width: `${pct}%`, height: 4, borderRadius: 999, background: 'var(--chart-1)',
            }} />
          </span>
        )}
      </Link>
    </Swipeable>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <div className="mx-[var(--gutter)] mb-2"><Label>{children}</Label></div>;
}
