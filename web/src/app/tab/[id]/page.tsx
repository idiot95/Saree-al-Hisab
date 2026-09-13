import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  actorOrNull, attachmentsForTxns, openClaimsFor, peopleForTab, tabById, tabEntries,
} from '@/db/queries';
import { waysToPay } from '@/db/payment';
import { format } from '@/lib/money';
import { headerBg } from '../../auth-ui';
import { Icon } from '../../Icon';
import Screen from '../../Screen';
import Back from '../../Back';
import TabEntries from './TabEntries';
import TabMenu from './TabMenu';
import TabContacts from './TabContacts';
import MoneyBack from './MoneyBack';

export const metadata = { title: 'Tab · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

/* A tab's screen answers one question — where do we stand on this — and then
   lets you act on the answer. Who is on it sits in the header; what went on it
   is a list you swipe (Remind, the bill, Delete); money back and the next cost
   are the two buttons under the thumb. The figures are the same arithmetic as
   the Loan centre's, filtered to this tab, so the two can never disagree.

   `?saved=<entry>` is how Add Entry hands over a cost it just put here: the
   screen opens on "Attach the bill?" for it. `?remind=all` is the Loan
   centre's swipe. */
export default async function Tab({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; remind?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const q = await searchParams;

  const tab = await tabById(actor.household_id, id);
  if (!tab) notFound();
  const [people, entries, ways, open] = await Promise.all([
    peopleForTab(actor.household_id, tab.id),
    tabEntries(actor.household_id, tab.id),
    waysToPay(actor.household_id),
    openClaimsFor(actor.household_id, tab.id),
  ]);
  const bills = await attachmentsForTxns(actor.household_id, entries.map((e) => e.id));

  const outstanding = Number(tab.outstanding);
  const back = Number(tab.back);
  const held = Number(tab.held);
  const canEdit = actor.role !== 'viewer';
  const closed = !!tab.closed_at;
  const today = new Date().toISOString().slice(0, 10);

  const claims = open.map((c) => ({
    id: c.id, personId: c.counterparty_id, person: c.person, tint: c.tint, txnId: c.txn_id,
    what: c.what, on: iso(c.occurred_on), outstanding: Number(c.outstanding),
  }));
  /* Who money can come back from: each person still owing, and the tab itself
     for what was put on it while nobody was named. */
  const owing = [
    ...people.filter((p) => Number(p.owed) > 0).map((p) => ({
      id: p.id as string | null, name: p.name, tint: p.tint, owed: Number(p.owed),
      claims: claims.filter((c) => c.personId === p.id),
    })),
    ...(held > 0 ? [{
      id: null, name: 'The tab itself', tint: 'indigo', owed: held,
      claims: claims.filter((c) => c.personId === null),
    }] : []),
  ];

  return (
    <Screen>
      <Back to="/people" />
      <main style={{
        minHeight: '100dvh', background: 'var(--c-bg)',
        paddingBottom: canEdit ? 'calc(104px + env(safe-area-inset-bottom, 0px))' : 'calc(80px + env(safe-area-inset-bottom, 0px))',
      }}>
        <header className="el2" style={{
          background: headerBg('purple'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 22px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/people" transitionTypes={['nav-back']} aria-label="Back" style={{
              width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
            }}>
              <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Link>
            {canEdit && (
              <TabMenu tabId={tab.id} name={tab.name} note={tab.note} closed={closed} held={held} />
            )}
          </div>
          <span style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.05em',
            padding: '5px 10px', borderRadius: 7, background: 'rgba(255,255,255,.16)',
          }}>
            <Icon name="folder" size={14} strokeWidth={2.2} />
            TAB{closed && ' · CLOSED'}
          </span>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            {tab.name}
          </h1>
          <span className="t" style={{ fontSize: 'var(--step-4)', letterSpacing: '-.022em' }}>
            {outstanding > 0 ? format(outstanding) : tab.costs === 0 ? 'Nothing on it yet' : 'Settled up'}
          </span>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            {[
              outstanding > 0 ? 'still to come back' : null,
              tab.costs > 0 ? `${format(Number(tab.put_on))} put on across ${tab.costs} ${tab.costs === 1 ? 'cost' : 'costs'}` : null,
              back > 0 ? `${format(back)} back` : null,
            ].filter(Boolean).join(' · ') || 'Add the first cost below.'}
          </p>
          {tab.note && (
            <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.7)' }}>{tab.note}</p>
          )}
          <TabContacts tabId={tab.id} canEdit={canEdit && !closed}
            people={people.map((p) => ({
              id: p.id, name: p.name, tint: p.tint, onTab: p.on_tab,
              inAll: Number(p.owed_in_all), owed: Number(p.owed),
            }))} />
        </header>

        <div style={{ paddingTop: 20 }}>
          <TabEntries
            tabId={tab.id} tabName={tab.name} canEdit={canEdit} today={today}
            saved={q.saved && UUID.test(q.saved) ? q.saved : null}
            remindAll={q.remind === 'all' && outstanding > 0}
            entries={entries.map((e) => ({
              id: e.id, on: iso(e.occurred_on), incoming: e.incoming,
              title: e.incoming
                ? (e.people ? `Came back from ${e.people}` : 'Came back')
                : (e.merchant || e.category || 'Cost'),
              icon: e.icon, tint: e.tint, amount: Number(e.amount),
              outstanding: Number(e.outstanding), bills: e.bills,
            }))}
            claims={claims}
            bills={bills.map((b) => ({ id: b.id, txnId: b.txn_id, name: b.name, mime: b.mime }))}
          />

          <p style={{
            margin: '4px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
          }}>
            A cost on this tab is owed back in full, split equally between the people on it — or
            held by the tab itself while nobody is named. Whether it was <em>your</em> spending is
            asked of each cost, and money back is never counted as income.
          </p>
        </div>

        {canEdit && (
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
            display: 'flex', gap: 9, padding: '12px var(--gutter) calc(14px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)',
          }}>
            <MoneyBack tabId={tab.id} ways={ways} today={today} owing={owing} />
            {closed ? (
              <span className="cta" style={{
                flex: 1.3, minHeight: 54, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--c-sunk)', color: 'var(--c-meta)',
              }}>Closed</span>
            ) : (
              <Link href={`/add?tab=${tab.id}`} transitionTypes={['nav-forward']} className="el cta" style={{
                flex: 1.3, minHeight: 54, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--g-primary)', color: 'var(--c-on-primary)', textDecoration: 'none',
              }}>
                <Icon name="plus" size={18} strokeWidth={2.2} />
                Add cost
              </Link>
            )}
          </div>
        )}
      </main>
    </Screen>
  );
}
