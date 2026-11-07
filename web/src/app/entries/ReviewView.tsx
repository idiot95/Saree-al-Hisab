import Link from '@/app/NavLink';
import { billsDue, duplicatesFor, schedulesFor } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { outstandingDues } from '@/lib/recur';
import { format } from '@/lib/money';
import DuplicateCard from '../inbox/DuplicateCard';
import Swipeable from '../Swipeable';
import { Icon } from '../Icon';
import { Empty, Section } from './parts';

/* Activity › To review: decisions, and nothing that is not one. Card bills as their day comes, and pairs that may
   be one purchase entered twice. Bank messages are decisions too, but they have their own chip (From SMS), so the
   two badges add up to Home's To review tile. What is merely due is pointed at, under Upcoming, not listed twice. */
export async function loadReview(hh: string, canWrite: boolean, sms: number) {
  const [dupes, bills, schedules] = await withHousehold(hh, () => Promise.all([
    duplicatesFor(hh),
    billsDue(hh),
    schedulesFor(hh),
  ]));
  const dues = outstandingDues(schedules, new Date(), 7);
  const count = dupes.length + bills.length;

  const body = (
    <div className="flex flex-col gap-5">
      {count === 0 && (
        <Empty icon="check_circle" tone="ok"
          text="Nothing to decide. Card bills show up here as their due date comes near, and so do two entries that look like one purchase recorded twice." />
      )}

      {bills.length > 0 && (
        <Section title="Card bills"
          foot="Swipe a bill to pay it: a transfer from the bank to the card. It is a move, not spending; the purchases were counted on the days they happened.">
          <div className="overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
            {bills.map((b, i) => {
              const soon = b.days_away <= 5;
              return (
                <Swipeable key={`${b.account_id}:${String(b.due_on)}`} actions={canWrite ? [
                  { label: 'Pay', icon: 'move', tone: 'primary',
                    href: `/add?kind=transfer&to=${b.account_id}&amount=${Number(b.outstanding)}` },
                ] : []}>
                  <div className={`flex min-h-[72px] items-center gap-3 py-2.5 ${i === bills.length - 1 ? '' : 'border-b border-border'}`}>
                    <span className={`grid size-10 flex-none place-items-center rounded-xl ${soon
                      ? 'bg-destructive/10 text-destructive' : 'bg-attention-soft text-attention-soft-foreground'}`}>
                      <Icon name="card" size={20} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-medium [overflow-wrap:anywhere]">{b.account}{b.last4 && ` · ${b.last4}`}</span>
                      <span className={`flex items-center gap-1 text-footnote ${soon ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {soon && <Icon name="schedule" size={14} />}
                        <span className="[overflow-wrap:anywhere]">
                          {b.days_away < 0 ? `Overdue by ${-b.days_away} ${-b.days_away === 1 ? 'day' : 'days'}`
                            : b.days_away === 0 ? 'Due today'
                            : `Due in ${b.days_away} ${b.days_away === 1 ? 'day' : 'days'}`}
                          {' · '}{b.entries} {b.entries === 1 ? 'purchase' : 'purchases'}
                        </span>
                      </span>
                    </span>
                    <span className="flex-none text-body font-semibold tabular-nums">{format(Number(b.outstanding))}</span>
                  </div>
                </Swipeable>
              );
            })}
          </div>
        </Section>
      )}

      {dupes.length > 0 && (
        <Section title="Possibly recorded twice"
          foot={canWrite ? undefined : 'Only owners and contributing members can act on these.'}>
          <div className="flex flex-col gap-3">
            {dupes.map((d) => (
              <DuplicateCard
                key={`${d.low_id}:${d.high_id}`}
                reason={d.reason}
                canWrite={canWrite}
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
          </div>
        </Section>
      )}

      {(sms > 0 || dues.length > 0) && (
        <div className="mx-[var(--gutter)] overflow-hidden rounded-[18px] bg-card">
          {sms > 0 && (
            <Pointer href="/entries?f=sms" icon="sms"
              strong={`${sms} bank ${sms === 1 ? 'message' : 'messages'}`} rest="under From SMS" />
          )}
          {dues.length > 0 && (
            <Pointer href="/entries?f=upcoming" icon="event_upcoming"
              strong={`${dues.length} due this week`} rest="under Upcoming" />
          )}
        </div>
      )}
    </div>
  );
  return { count, sub: count === 0 ? 'Nothing to review' : `${count} to review`, body };
}

function Pointer({ href, icon, strong, rest }: { href: string; icon: string; strong: string; rest: string }) {
  return (
    <Link href={href} replace data-replace motion="fade"
      className="press flex min-h-14 items-center gap-3 border-b border-border px-3.5 last:border-b-0">
      <Icon name={icon} size={22} className="text-primary" />
      <span className="flex-1 text-body"><b className="font-semibold">{strong}</b>
        <span className="text-muted-foreground"> · {rest}</span></span>
      <Icon name="chevron_right" size={18} className="text-muted-foreground" />
    </Link>
  );
}
