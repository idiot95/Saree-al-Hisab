import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, billsDue, duplicatesFor, purgeSmsBodies, schedulesFor, smsDrafts, type SmsDraftRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { outstandingDues } from '@/lib/recur';
import { format } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import DuplicateCard from './DuplicateCard';
import Screen from '../Screen';
import PageHead, { Label } from '../PageHead';
import ActivityNav from '../entries/ActivityNav';
import Swipeable from '../Swipeable';
import { Icon } from '../Icon';
import SmsDrafts, { type SmsRow } from './SmsDrafts';

export const metadata = { title: 'To review · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Things that want a decision, and nothing that does not. An inbox which
   collects notices nobody can act on stops being read, and then the one item
   that mattered is missed along with the rest. */
export default async function Inbox({ searchParams }: { searchParams: Promise<{ dismissed?: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const hh = actor.household_id;
  /* Forwarded bank messages lose their text once handled or after thirty days; with no scheduler, the screens
     that list them do it as they open. */
  const [dupes, bills, schedules, sms] = await withHousehold(hh, async () => {
    await purgeSmsBodies(hh);
    return Promise.all([
      duplicatesFor(hh),
      billsDue(hh),
      schedulesFor(hh),
      smsDrafts(hh),
    ]);
  });
  const canWrite = actor.role !== 'viewer';
  const now = new Date();
  const dues = outstandingDues(schedules, now, 7);
  /* The same three things Activity's badge and Home's tile count (reviewCount): decisions. What is merely due
     lives under Upcoming, and is pointed at from here rather than listed twice. */
  const count = dupes.length + bills.length + sms.length;
  const smsRows = sms.map(toRow);
  /* Dismissed from the message's own screen: the list offers the Undo that screen could not. */
  const { dismissed } = await searchParams;
  const justDismissed = canWrite && typeof dismissed === 'string' && UUID.test(dismissed) ? dismissed : null;

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead title="Activity" sub={count === 0 ? 'Nothing to review' : `${count} to review`}>
          <ActivityNav current="inbox" review={count} />
        </PageHead>

        {/* Always in the tree, so the Undo on a dismissed message outlives the list it emptied. */}
        <SmsDrafts rows={smsRows} canWrite={canWrite} justDismissed={justDismissed} />

        {count === 0 ? (
          <div className="mx-[var(--gutter)] flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-center">
            <Icon name="check_circle" size={34} className="text-money-in" />
            <p className="max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
              No card bills waiting, no possible duplicates and no bank messages. This fills itself when something
              wants deciding.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {bills.length > 0 && (
              <>
                <section aria-label="Card bills" className="mx-[var(--gutter)] flex flex-col gap-2">
                <Label>Card bills</Label>
                <div className="overflow-hidden rounded-2xl border border-border bg-card px-4">
                  {bills.map((b, i) => {
                    const soon = b.days_away <= 5;
                    return (
                      <Swipeable key={`${b.account_id}:${String(b.due_on)}`} actions={canWrite ? [
                        { label: 'Pay', icon: 'move', tone: 'primary',
                          href: `/add?kind=transfer&to=${b.account_id}&amount=${Number(b.outstanding)}` },
                      ] : []}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, minHeight: 78,
                        borderBottom: i === bills.length - 1 ? undefined : '1px solid var(--border)',
                      }}>
                        <span style={{
                          width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          background: soon ? 'color-mix(in srgb, var(--destructive) 12%, transparent)' : 'var(--attention-soft)',
                          color: soon ? 'var(--destructive)' : 'var(--attention-soft-foreground)',
                        }}>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" />
                          </svg>
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                            {b.account}{b.last4 && ` · ${b.last4}`}
                          </span>
                          <span style={{
                            fontSize: 'var(--step--1)', color: soon ? 'var(--destructive)' : 'var(--muted-foreground)',
                          }}>
                            {b.days_away < 0 ? `overdue by ${-b.days_away} days`
                              : b.days_away === 0 ? 'due today'
                              : `due in ${b.days_away} days`}
                            {' · '}{b.entries} {b.entries === 1 ? 'purchase' : 'purchases'}
                          </span>
                        </span>
                        <span className="t amt" style={{ fontSize: 'var(--step-1)' }}>{format(Number(b.outstanding))}</span>
                      </div>
                      </Swipeable>
                    );
                  })}
                </div>
                <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                  Swipe a bill to pay it: a transfer from the bank to the card. It is a move, not
                  spending; the purchases were counted on the days they happened.
                </p>
                </section>
              </>
            )}

            {dupes.length > 0 && (
              <>
                <div className="mx-[var(--gutter)]"><Label>Possibly recorded twice</Label></div>
                {dupes.map((d) => (
                  <DuplicateCard
                    key={`${d.low_id}:${d.high_id}`}
                    reason={d.reason}
                    low={{
                      id: d.low_id, amount: d.low_amount,
                      on: new Date(d.low_on).toISOString().slice(0, 10),
                      merchant: d.low_merchant, who: d.low_who,
                      account: d.low_account, category: d.low_category,
                    }}
                    high={{
                      id: d.high_id, amount: d.high_amount,
                      on: new Date(d.high_on).toISOString().slice(0, 10),
                      merchant: d.high_merchant, who: d.high_who,
                      account: d.high_account, category: d.high_category,
                    }}
                  />
                ))}
                {!canWrite && (
                  <p style={{
                    margin: '0 var(--gutter)', fontSize: 'var(--step--1)', color: 'var(--muted-foreground)', textAlign: 'center',
                  }}>
                    Only owners and contributing members can act on these.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {dues.length > 0 && (
          <Link href="/schedules" transitionTypes={['nav-lateral']}
            className="mx-[var(--gutter)] mt-5 flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4">
            <Icon name="event_upcoming" size={20} className="text-muted-foreground" />
            <span className="flex-1 text-sm"><b className="font-semibold">{dues.length} due this week</b>
              <span className="text-muted-foreground"> · under Upcoming</span></span>
            <Icon name="chevron_right" size={17} className="text-muted-foreground" />
          </Link>
        )}
        <TabBar current="/inbox" />
      </main>
    </Screen>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function toRow(d: SmsDraftRow): SmsRow {
  return {
    id: d.id,
    amount: d.amount === null ? null : Number(d.amount),
    direction: d.direction,
    merchant: d.merchant,
    when: d.on_date ? day(d.on_date)
      : new Date(d.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
    account: d.account,
    last4: d.last4,
    sender: d.sender,
  };
}
