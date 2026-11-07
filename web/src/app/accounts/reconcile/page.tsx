import Link from '@/app/NavLink';
import { Empty } from '../../entries/parts';
import { redirect } from 'next/navigation';
import { actorOrNull, reconcileTargets } from '@/db/queries';
import { format } from '@/lib/money';
import { Chip, Icon, ACCOUNT_ICON, ACCOUNT_TINT } from '../../Icon';
import TabBar from '../../TabBar';
import { TAB_BAR_SPACE } from '../../tabs';
import PageHead from '../../PageHead';
import Screen from '../../Screen';

export const metadata = { title: 'Reconcile · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Which account to match against a statement. Each row says when it was last
   matched and how many entries have come in since — the ones a statement
   will be asked about. */
export default async function ReconcilePicker() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const accounts = await reconcileTargets(actor.household_id);
  const canWrite = actor.role !== 'viewer';

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/accounts" title="Reconcile"
          sub="Match an account to its statement: tick off what the statement shows, and find what the books are missing." />

        <section aria-labelledby="sec-which" className="flex flex-col gap-1.5 px-[var(--gutter)] pb-8">
          <h2 id="sec-which" className="px-0.5 text-[13px] font-semibold text-muted-foreground">Which account</h2>
          {accounts.length === 0 && (
            /* The way to add one only for someone who may: a viewer is told there is nothing yet, and no more. */
            <Empty icon="account_balance" inset={false}
              text={canWrite ? 'No account to match yet. Add your bank account first.' : 'No account to match yet.'}
              action={canWrite ? { href: '/accounts', label: 'Add an account', icon: 'add' } : undefined} />
          )}
          <ul className="overflow-hidden rounded-[18px] bg-card empty:hidden">
            {accounts.map((a) => {
              const bal = Number(a.balance);
              const credit = a.kind === 'credit';
              return (
                <li key={a.id} className="border-b border-border last:border-b-0">
                  <Link href={`/accounts/${a.id}/reconcile`} transitionTypes={['nav-forward']}
                    className="press flex min-h-[72px] items-center gap-3 px-[var(--pad)] py-3 text-foreground no-underline">
                    <Chip icon={ACCOUNT_ICON[a.kind]} tint={ACCOUNT_TINT[a.kind]} size={38} radius={999} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">
                        {a.name}{a.last4 ? <span className="font-medium text-muted-foreground"> · {a.last4}</span> : null}
                      </span>
                      <span className="text-[13px] leading-snug text-muted-foreground">
                        {a.last_on ? <Icon name="check_circle" size={14} className="mr-1 align-[-2px]" /> : <Icon name="schedule" size={14} className="mr-1 align-[-2px]" />}
                        {a.last_on
                          ? `Matched ${new Date(`${a.last_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                          : 'Never matched'}
                        {` · ${a.open} ${a.open === 1 ? 'entry' : 'entries'} ${a.last_on ? 'since' : 'to check'}`}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end gap-0.5">
                      <span className="text-[15px] font-semibold tabular-nums">{format(Math.abs(bal))}</span>
                      <span className="text-xs text-muted-foreground">
                        {credit ? (bal < 0 ? 'owed' : 'in credit') : bal < 0 ? 'overdrawn' : 'in the books'}
                      </span>
                    </span>
                    <Icon name="chevron_right" size={20} className="flex-none text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <TabBar current="/accounts" />
      </main>
    </Screen>
  );
}
