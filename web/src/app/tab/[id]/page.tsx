import Link from '@/app/NavLink';
import { notFound, redirect } from 'next/navigation';
import {
  actorOrNull, attachmentsForTxns, openClaimsFor, peopleForTab, tabById, tabEntries,
} from '@/db/queries';
import { withHousehold } from '@/db/client';
import { waysToPay } from '@/db/payment';
import { Icon } from '../../Icon';
import { Figure } from '../../Figure';
import { BACK_SPACE } from '../../tabs';
import PageHead from '../../PageHead';
import Screen from '../../Screen';
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

  /* One transaction for the whole screen: every query below shares it, rather
     than each opening, scoping and committing its own. */
  const hh = actor.household_id;
  const { tab, people, entries, ways, open, bills } = await withHousehold(hh, async () => {
    const [tab, people, entries, ways, open] = await Promise.all([
      tabById(hh, id), peopleForTab(hh, id), tabEntries(hh, id), waysToPay(hh), openClaimsFor(hh, id),
    ]);
    const bills = tab ? await attachmentsForTxns(hh, entries.map((e) => e.id)) : [];
    return { tab, people, entries, ways, open, bills };
  });
  if (!tab) notFound();

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
      <main className="min-h-dvh bg-background text-foreground"
        style={{ paddingBottom: canEdit ? 'calc(112px + env(safe-area-inset-bottom, 0px))' : BACK_SPACE }}>
        <PageHead back="/people" eyebrow={<>Tab{closed && ' · closed'}</>} title={tab.name}
          right={canEdit ? <TabMenu tabId={tab.id} name={tab.name} note={tab.note} closed={closed} held={held} /> : undefined} />

        <div className="flex flex-col gap-5 pb-6">
          <div className="flex flex-col gap-3 px-[var(--gutter)]">
            {/* What is still to come back is money arriving, so it wears money-in and a +. Settled and empty say so
                in words, with an icon for settled. */}
            <section aria-label={outstanding > 0 ? 'Still to come back' : 'On this tab'}
              className="flex flex-col gap-2 rounded-[22px] bg-card p-[18px]">
              <span className="text-[13px] text-muted-foreground">{outstanding > 0 ? 'Still to come back' : 'On this tab'}</span>
              {outstanding > 0 ? (
                <Figure minor={outstanding} sign
                  className="text-[38px] font-bold leading-none tracking-tight text-money-in tabular-nums" />
              ) : (
                <span className="flex items-center gap-2 text-[30px] font-bold leading-none tracking-tight">
                  {tab.costs > 0 && <Icon name="check_circle" size={28} className="text-money-in" />}
                  {tab.costs === 0 ? 'Nothing yet' : 'Settled up'}
                </span>
              )}
              <p className="text-[13px] leading-snug text-muted-foreground">
                {tab.costs > 0 || back > 0 ? (
                  <>
                    {tab.costs > 0 && <><Figure minor={Number(tab.put_on)} /> put on across {tab.costs} {tab.costs === 1 ? 'cost' : 'costs'}</>}
                    {tab.costs > 0 && back > 0 && ' · '}
                    {back > 0 && <><Figure minor={back} /> back</>}
                  </>
                ) : 'Add the first cost below.'}
              </p>
              {tab.note && <p className="text-[13px] text-muted-foreground">{tab.note}</p>}
            </section>
            <TabContacts tabId={tab.id} canEdit={canEdit && !closed}
              people={people.map((p) => ({
                id: p.id, name: p.name, tint: p.tint, onTab: p.on_tab,
                inAll: Number(p.owed_in_all), owed: Number(p.owed),
              }))} />
          </div>

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

          <p className="px-[var(--gutter)] text-[13px] leading-relaxed text-muted-foreground">
            A cost on this tab is owed back in full, split equally between the people on it — or
            held by the tab itself while nobody is named. Whether it was <em>your</em> spending is
            asked of each cost, and money back is never counted as income.
          </p>
        </div>

        {canEdit && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-background px-[var(--gutter)] pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
            <MoneyBack tabId={tab.id} ways={ways} today={today} owing={owing} />
            {closed ? (
              <span className="flex min-h-[54px] flex-[1.3] items-center justify-center gap-2 rounded-2xl bg-muted text-base font-semibold text-muted-foreground">
                <Icon name="folder" size={18} />Closed
              </span>
            ) : (
              <Link href={`/add?tab=${tab.id}`} transitionTypes={['nav-forward']}
                className="press flex min-h-[54px] flex-[1.3] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground">
                <Icon name="plus" size={18} />
                Add cost
              </Link>
            )}
          </div>
        )}
      </main>
    </Screen>
  );
}
