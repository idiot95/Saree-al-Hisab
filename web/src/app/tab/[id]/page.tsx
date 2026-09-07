import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { actorOrNull, methodsFor, openClaimsFor, peopleForTab, tabById, tabEntries } from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../../auth-ui';
import { Chip, Icon } from '../../Icon';
import TabPeople from './TabPeople';
import Screen from '../../Screen';
import Back from '../../Back';
import { BACK_SPACE } from '../../tabs';
import Swipeable from '../../Swipeable';

export const metadata = { title: 'Tab · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* A tab's screen answers one question — where do we stand on this — and then
   lets you act on the answer: take money back from whoever owes, put more on
   it, change who is on it. The figures come from the same arithmetic as the
   khata, only filtered to this tab, so the two can never disagree. */
export default async function Tab({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const tab = await tabById(actor.household_id, id);
  if (!tab) notFound();
  const [people, entries, methods, open] = await Promise.all([
    peopleForTab(actor.household_id, tab.id),
    tabEntries(actor.household_id, tab.id),
    methodsFor(actor.household_id),
    openClaimsFor(actor.household_id, tab.id),
  ]);

  const members = people.filter((p) => p.on_tab);
  const owed = people.reduce((n, p) => n + Number(p.owed), 0);
  const claimed = people.reduce((n, p) => n + Number(p.owed_in_all), 0);
  const back = people.reduce((n, p) => n + Number(p.back), 0);
  const costs = entries.filter((e) => !e.incoming);
  const canEdit = actor.role !== 'viewer';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Screen>
      <Back to="/people" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: BACK_SPACE }}>
        <header className="el2" style={{
          background: headerBg('purple'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 24px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/people" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <span style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.05em',
            padding: '5px 10px', borderRadius: 7, background: 'rgba(255,255,255,.16)',
          }}>
            <Icon name="tab" size={14} strokeWidth={2.2} />
            TAB{tab.closed_at && ' · CLOSED'}
          </span>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            {tab.name}
          </h1>
          <span className="t" style={{ fontSize: 'var(--step-4)', letterSpacing: '-.022em' }}>
            {owed === 0 ? 'Settled up' : format(owed)}
          </span>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            {owed > 0 ? 'still to come back · ' : ''}
            {costs.length === 0
              ? 'Nothing on it yet'
              : `${format(claimed)} claimed across ${costs.length} ${costs.length === 1 ? 'cost' : 'costs'}`}
            {back > 0 ? ` · ${format(back)} back` : ''}
          </p>
          {tab.note && (
            <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.7)' }}>{tab.note}</p>
          )}
        </header>

        <div style={{ paddingTop: 20 }}>
          {canEdit && !tab.closed_at && (
            <Link href={`/add?tab=${tab.id}`} transitionTypes={['nav-forward']} className="el cta" style={{
              margin: '0 var(--gutter) 22px', width: 'calc(100% - 36px)', minHeight: 54, borderRadius: 15,
              background: 'var(--g-primary)', color: 'var(--c-on-primary)',
              fontSize: 'var(--step-0)', fontWeight: 600, textDecoration: 'none',
              opacity: members.length === 0 ? 0.5 : 1, pointerEvents: members.length === 0 ? 'none' : undefined,
            }}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
              Put a cost on this tab
            </Link>
          )}

          <TabPeople
            tabId={tab.id} tabName={tab.name} note={tab.note}
            people={people} closed={!!tab.closed_at} canEdit={canEdit}
            methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
            open={open.map((c) => ({
              id: c.id, person_id: c.counterparty_id, what: c.what,
              on: new Date(c.occurred_on).toISOString().slice(0, 10), outstanding: Number(c.outstanding),
            }))}
            today={today}
          />

          {entries.length > 0 && (
            <>
              <Head>What went on it</Head>
              <section className="el card" style={{
                margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18,
                padding: '0 var(--pad)', overflow: 'hidden',
              }}>
                {entries.map((e, i) => (
                  <Swipeable key={e.id} actions={canEdit ? [
                    { label: 'Edit', icon: 'pencil', tone: 'primary', href: `/entries/${e.id}` },
                  ] : []}>
                  <Link href={`/entries/${e.id}`} transitionTypes={['nav-forward']} draggable={false} style={{
                    display: 'flex', alignItems: 'center', gap: 12, minHeight: 66,
                    textDecoration: 'none', color: 'var(--c-ink)',
                    borderBottom: i === entries.length - 1 ? undefined : '1px solid var(--c-rule)',
                  }}>
                    {e.incoming
                      ? <Chip icon="receivable" tint="green" />
                      : <Chip icon={e.icon} tint={e.tint} />}
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{
                        fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {e.incoming
                          ? `Came back from ${e.people ?? 'them'}`
                          : e.merchant || e.category || 'Cost'}
                      </span>
                      <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                        {new Date(e.occurred_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' · '}{e.who}
                        {!e.incoming && e.people ? ` · ${e.people}` : ''}
                        {!e.incoming && Number(e.outstanding) > 0
                          ? ` · ${format(Number(e.outstanding))} still owed`
                          : !e.incoming ? ' · settled' : ''}
                        {!e.incoming && !e.counts_as_spend ? ' · not your spending' : ''}
                      </span>
                    </span>
                    <span className="t" style={{
                      fontSize: 'var(--step-0)',
                      color: e.incoming ? 'var(--c-in)' : 'var(--c-out)',
                    }}>
                      {e.incoming ? '+' : ''}{format(Number(e.amount))}
                    </span>
                  </Link>
                  </Swipeable>
                ))}
              </section>
            </>
          )}

          <p style={{
            margin: '4px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
          }}>
            A cost put on this tab is owed back in full unless you say otherwise, divided
            equally among the people on it, and each share becomes a claim the moment it is
            saved. Whether the cost was <em>your</em> spending is a separate question, asked
            of each entry: petrol you burned and are paid back for counts in your month;
            a ticket you fronted for someone else does not. Either way, taking money back
            here brings it into whichever of your accounts it actually arrived in.
          </p>
        </div>
      </main>
    </Screen>
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
