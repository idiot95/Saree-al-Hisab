import Link from '@/app/NavLink';
import { Empty } from '../entries/parts';
import { redirect } from 'next/navigation';
import { actorOrNull, claimsFor, peopleFor, receiptsByMonth, tabList, type TabRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import NewTab from '../tab/NewTab';
import { Chip, Icon } from '../Icon';
import Screen from '../Screen';
import PageHead from '../PageHead';
import { Figure } from '../Figure';
import { owedToYou } from '@/lib/worth';
import Swipeable from '../Swipeable';
import { Face, tabTint } from '../tab/look';

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

  const lent = people.filter((p) => Number(p.balance) !== 0);
  const { owed, youOwe } = owedToYou(claims, people);
  const backThisMonth = Number(receipts[0]?.back ?? 0);

  /* A tab stays in the open list while anything is owed on it, or while it is
     new and empty; settled and closed tabs fold away underneath. */
  const open = tabs.filter((t) => !t.closed_at && (Number(t.outstanding) > 0 || t.costs === 0));
  const done = tabs.filter((t) => !open.includes(t));
  const month = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead title="Loans" right={canWrite ? <NewTab /> : undefined} />

        <div className="flex flex-col gap-5 px-[var(--gutter)] pb-6">
          {/* "Owed to you" is Home's figure exactly (owedToYou().owed, gross): money arriving, so money-in with a +.
              What you owe others is never netted against it; it is its own line, in plain ink, with the words. */}
          <section aria-label="Owed to you" className="flex flex-col gap-2 rounded-[22px] bg-card p-[18px]">
            <span className="text-subhead text-muted-foreground">Owed to you</span>
            <Figure minor={owed} sign={owed > 0}
              className={`text-display font-bold leading-none tracking-tight tabular-nums ${owed > 0 ? 'text-money-in' : ''}`} />
            {youOwe > 0 && (
              <span className="text-body font-medium">
                You owe <Figure minor={youOwe} className="font-semibold tabular-nums" />
              </span>
            )}
            <span className="text-subhead leading-snug text-muted-foreground">
              {tabs.length === 0 && lent.length === 0
                ? 'A tab keeps what you put down for others (a trip, the office, a cousin) and what comes back.'
                : [
                    `Across ${open.length} open ${open.length === 1 ? 'tab' : 'tabs'}`,
                    backThisMonth > 0 ? `${format(backThisMonth)} came back in ${month}` : null,
                  ].filter(Boolean).join(' · ')}
            </span>
          </section>

          {tabs.length === 0 && lent.length === 0 && (
            /* Nothing to list yet: what would be here, and where to start (New tab, in the header). */
            <Empty icon="group" inset={false} text={canWrite ? 'No tabs yet. New tab, above, starts one.' : 'No tabs yet.'} />
          )}

          {open.length > 0 && (
            <section aria-label="Open tabs" className="flex flex-col gap-1.5">
              <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">Open tabs</h2>
              {/* px-[var(--pad)] and overflow-hidden: the swipe row's negative margin is --pad, so its actions stop
                  at the card's rounded edge and the card never scrolls sideways. */}
              <div className="overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
                {open.map((t, i) => <TabItem key={t.id} t={t} last={i === open.length - 1} canWrite={canWrite} />)}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <details className="group overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 text-body font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                <Icon name="check_circle" size={22} />
                <span className="flex-1">{done.length} settled or closed {done.length === 1 ? 'tab' : 'tabs'}</span>
                <Icon name="expand_more" size={20} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border">
                {done.map((t, i) => <TabItem key={t.id} t={t} last={i === done.length - 1} canWrite={false} quiet />)}
              </div>
            </details>
          )}

          {/* Money handed to someone outside any tab — the older khata. Only shown when there is some, so it never
              asks to be managed. */}
          {lent.length > 0 && (
            <section aria-label="Lent outside a tab" className="flex flex-col gap-1.5">
              <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">Lent outside a tab</h2>
              <ul className="overflow-hidden rounded-[18px] bg-card">
                {lent.map((p) => {
                  const bal = Number(p.balance);
                  return (
                    <li key={p.id} className="border-b border-border last:border-b-0">
                      <Link href={`/people/${p.id}`}
                        className="press flex min-h-16 items-center gap-3 px-3.5">
                        <Face name={p.name} tint={p.tint} size={36} />
                        <span className="min-w-0 flex-1 text-body font-medium leading-snug [overflow-wrap:anywhere]">{p.name}</span>
                        <span className="flex flex-col items-end gap-0.5">
                          <Figure minor={Math.abs(bal)} sign={bal > 0}
                            className={`text-body font-semibold tabular-nums ${bal > 0 ? 'text-money-in' : ''}`} />
                          <span className="text-footnote text-muted-foreground">{bal > 0 ? 'owes you' : 'you owe'}</span>
                        </span>
                        <Icon name="chevron_right" size={18} className="text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
        <TabBar current="/people" />
      </main>
    </Screen>
  );
}

const day = (d: Date | string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/* One tab, as the list row the mock draws: its folder in the tab's own tint, the name, the count
   of costs and the last day anything happened (who is on it and what came back are on the tab itself), and what is still to come back. Swipe for Remind and Add cost —
   both also a tap away inside. */
function TabItem({ t, last, canWrite, quiet = false }: { t: TabRow; last: boolean; canWrite: boolean; quiet?: boolean }) {
  const outstanding = Number(t.outstanding);
  const actions = canWrite && !t.closed_at ? [
    ...(outstanding > 0 ? [{ label: 'Remind', icon: 'bell', tone: 'neutral' as const, href: `/tab/${t.id}?remind=all` }] : []),
    { label: 'Add cost', icon: 'plus', tone: 'primary' as const, href: `/add?tab=${t.id}` },
  ] : [];
  const sub = [
    t.costs === 0 ? 'Nothing on it yet' : `${t.costs} ${t.costs === 1 ? 'cost' : 'costs'}`,
    t.last_on ? `last cost ${day(t.last_on)}` : null,
    t.closed_at ? 'closed' : null,
  ].filter(Boolean).join(' · ');

  return (
    <Swipeable actions={actions} commit={false}>
      <Link href={`/tab/${t.id}`} draggable={false}
        className={`relative flex min-h-16 items-center gap-3 py-3 ${last ? '' : 'after:absolute after:right-0 after:bottom-0 after:left-12 after:h-px after:bg-border'} ${quiet ? 'opacity-75' : ''}`}>
        <Chip icon="folder" tint={tabTint(t.id)} size={36} radius={999} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body font-medium leading-snug [overflow-wrap:anywhere]">{t.name}</span>
          <span className="text-footnote leading-snug text-muted-foreground">{sub}</span>
        </span>
        {outstanding > 0 ? (
          <Figure minor={outstanding} className="flex-none text-body font-semibold tabular-nums" />
        ) : (
          <span className="flex flex-none items-center gap-1 text-subhead font-medium text-muted-foreground">
            {t.costs > 0 ? <><Icon name="check" size={16} />Settled</> : 'Empty'}
          </span>
        )}
      </Link>
    </Swipeable>
  );
}
