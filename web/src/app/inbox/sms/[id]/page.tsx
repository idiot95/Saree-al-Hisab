import Link from '@/app/NavLink';
import { notFound, redirect } from 'next/navigation';
import { actorOrNull, purgeSmsBodies, smsDraftWithBody } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format } from '@/lib/money';
import PageHead, { Label } from '../../../PageHead';
import Screen from '../../../Screen';
import TabBar from '../../../TabBar';
import { TAB_BAR_SPACE } from '../../../tabs';
import { Icon } from '../../../Icon';
import { DIRECTION } from '../../direction';
import DismissDraft from './DismissDraft';

export const metadata = { title: 'Bank message · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const STATUS = {
  open: { icon: 'schedule', word: 'Waiting for you' },
  accepted: { icon: 'check_circle', word: 'Added as an entry' },
  dismissed: { icon: 'close', word: 'Dismissed' },
} as const;

/* The one screen where the message itself is shown, as it arrived: what was read from it sits beside the text it
   was read from, so a wrong figure is easy to spot before it becomes an entry. */
export default async function SmsDraft({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const hh = actor.household_id;
  const d = await withHousehold(hh, async () => {
    await purgeSmsBodies(hh);
    return smsDraftWithBody(hh, id);
  });
  if (!d) notFound();
  const canWrite = actor.role !== 'viewer';
  const dir = DIRECTION[d.direction ?? 'none'];
  const status = STATUS[d.status];
  const received = new Date(d.received_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
  const facts: [string, string][] = [
    ['Amount', d.amount !== null ? format(Number(d.amount), undefined, { paise: 'auto' }) : 'Not found'],
    ['Where', d.merchant ?? 'Not found'],
    ['Date', d.on_date ? new Date(`${d.on_date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not found'],
    ['Account', d.account ?? (d.last4 ? `Ending ${d.last4} · not one of your accounts` : 'Not named')],
  ];

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/entries?f=sms" title="Bank message" sub={`${d.sender ? `From ${d.sender} · ` : ''}${received}`} />
        <div className="flex flex-col gap-5 px-[var(--gutter)]">
          <p className="flex min-h-11 items-center gap-2 self-start rounded-full bg-muted px-3.5 text-body font-semibold">
            <Icon name={status.icon} size={18} /> {status.word}
          </p>

          <section aria-label="The message" className="flex flex-col gap-2">
            <Label>The message</Label>
            {d.body
              ? <p className="whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 text-body leading-relaxed [overflow-wrap:anywhere]">{d.body}</p>
              : <p className="rounded-2xl border border-dashed border-border p-4 text-subhead leading-relaxed text-muted-foreground">
                  The text was deleted once it was handled, or after 30 days. What was read from it is below.
                </p>}
          </section>

          <section aria-label="What was read from it" className="flex flex-col gap-2">
            <Label>What was read from it</Label>
            <dl className="rounded-2xl border border-border bg-card px-4">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border">
                <dt className="text-subhead text-muted-foreground">Direction</dt>
                <dd className="flex items-center gap-1.5 text-body font-semibold"><Icon name={dir.icon} size={18} /> {dir.word}</dd>
              </div>
              {facts.map(([k, v], i) => (
                <div key={k} className={`flex min-h-12 items-center justify-between gap-3 ${i === facts.length - 1 ? '' : 'border-b border-border'}`}>
                  <dt className="text-subhead text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 text-right text-body font-semibold [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
            {d.via === 'model' && (
              <p className="px-1 text-footnote leading-relaxed text-muted-foreground">Read with your Gemini key: check it before saving.</p>
            )}
          </section>

          {d.status === 'open' && canWrite && (
            <div className="flex flex-col gap-2.5">
              <Link href={`/add?draft=${d.id}`}
                className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-headline font-semibold text-primary-foreground">
                <Icon name="add" size={20} /> Review and add
              </Link>
              <DismissDraft id={d.id} />
            </div>
          )}
        </div>
        <TabBar current="/entries" />
      </main>
    </Screen>
  );
}
