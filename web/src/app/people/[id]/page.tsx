import { notFound, redirect } from 'next/navigation';
import {
  actorOrNull, attachmentsForTxns, categoriesFor, claimsFor, personById, personLedger,
} from '@/db/queries';
import { withHousehold } from '@/db/client';
import { waysToPay } from '@/db/payment';
import { format } from '@/lib/money';
import PersonActions from './PersonActions';
import Claims from './Claims';
import PageHead from '../../PageHead';
import Screen from '../../Screen';
import { BACK_SPACE } from '../../tabs';
import { Figure } from '../../Figure';
import { Icon } from '../../Icon';

export const metadata = { title: 'Person · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Each line says what happened in a word with its icon, so the colour is never the only signal. */
const WORD = {
  lent: { word: 'Lent', icon: 'payments', tone: '' },
  back: { word: 'Paid back', icon: 'check_circle', tone: 'text-primary' },
  written_off: { word: 'Written off', icon: 'delete', tone: 'text-destructive' },
} as const;

export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const person = await personById(actor.household_id, id);
  if (!person) notFound();

  const hh = actor.household_id;
  const [ledger, ways, cats, claims] = await withHousehold(hh, () => Promise.all([
    personLedger(hh, person.account_id),
    waysToPay(hh),
    categoriesFor(hh),
    claimsFor(hh, person.id),
  ]));
  /* The bills behind whatever is still owed, so a reminder can carry the
     evidence. Only the open ones: a settled claim needs no chasing. */
  const bills = await attachmentsForTxns(
    actor.household_id,
    [...new Set(claims.filter((c) => Number(c.outstanding) > 0).map((c) => c.txn_id))],
  );
  const balance = Number(person.balance);
  const owedOnClaims = claims
    .filter((c) => c.status === 'open' || c.status === 'part_paid')
    .reduce((n, c) => n + Number(c.outstanding), 0);
  const canWrite = actor.role !== 'viewer';

  const settled = balance === 0 && owedOnClaims === 0;
  /* What this person owes you is money arriving: money-in and a +. What you owe them is plain ink with the words.
     The two directions are never added into one figure: when both are open (you owe them on a loan, they owe you
     for shared costs) the card shows each on its own. */
  const theyOwe = balance >= 0;
  const youOweOnly = balance < 0 && owedOnClaims === 0;
  const bothWays = balance < 0 && owedOnClaims > 0;
  const label = settled || bothWays ? 'Between you' : theyOwe ? 'Owes you' : 'You owe';
  const big = 'text-[38px] font-bold leading-none tracking-tight tabular-nums';

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: BACK_SPACE }}>
        <PageHead back="/people" eyebrow="Loans" title={person.name} />

        <div className="flex flex-col gap-5 pb-6">
          <section aria-label={label} className="mx-[var(--gutter)] flex flex-col gap-2 rounded-[22px] bg-card p-[18px]">
            <span className="text-[13px] text-muted-foreground">{label}</span>
            {settled ? (
              <span className="flex items-center gap-2 text-[30px] font-bold leading-none tracking-tight">
                <Icon name="check_circle" size={28} className="text-money-in" />Settled up
              </span>
            ) : bothWays ? (
              <dl className="grid grid-cols-2 gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Owes you, for shared costs</dt>
                  <dd><Figure minor={owedOnClaims} sign className="text-[28px] font-bold leading-none tracking-tight text-money-in tabular-nums" /></dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">You owe, on loans</dt>
                  <dd><Figure minor={-balance} className="text-[28px] font-bold leading-none tracking-tight tabular-nums" /></dd>
                </div>
              </dl>
            ) : youOweOnly ? (
              <Figure minor={-balance} className={big} />
            ) : (
              <Figure minor={balance + owedOnClaims} sign className={`${big} text-money-in`} />
            )}
            {/* Lending and shared costs are different debts and are said apart — conflating them is what makes a
                khata stop being trusted. */}
            {!bothWays && (
              <p className="text-[13px] leading-snug text-muted-foreground">
                {settled
                  ? `Nothing outstanding between you${person.phone ? ` · ${person.phone}` : ''}`
                  : [
                      balance > 0 ? `${format(balance)} lent` : null,
                      balance < 0 ? `${format(-balance)} you owe` : null,
                      owedOnClaims > 0 ? `${format(owedOnClaims)} for shared costs` : null,
                    ].filter(Boolean).join(' · ')}
              </p>
            )}
          </section>

          {canWrite && (
            <PersonActions
              personId={person.id} name={person.name} balance={balance}
              ways={ways}
              categories={cats}
            />
          )}

          <Claims
            claims={claims.map((c) => ({
              id: c.id, txn_id: c.txn_id, expected_amount: c.expected_amount,
              received: c.received, outstanding: c.outstanding, status: c.status,
              note: c.note, merchant: c.merchant, category: c.category,
              occurred_on: new Date(c.occurred_on).toISOString().slice(0, 10),
            }))}
            ways={ways}
            canEdit={canWrite}
            person={person.name}
            bills={bills.map((b) => ({ id: b.id, txn_id: b.txn_id, name: b.name, mime: b.mime }))}
          />

          <section aria-label="Money lent and returned" className="mx-[var(--gutter)] flex flex-col gap-1.5">
            <h2 className="px-0.5 text-[13px] font-semibold text-muted-foreground">Money lent and returned</h2>
            {ledger.length === 0 ? (
              <p className="rounded-[18px] bg-card px-3.5 py-4 text-[13px] text-muted-foreground">Nothing between you yet.</p>
            ) : (
              <ul className="overflow-hidden rounded-[18px] bg-card">
                {ledger.map((e) => {
                  const w = WORD[e.direction];
                  return (
                    <li key={e.id} className="flex min-h-16 items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={`flex items-center gap-1.5 text-[15px] font-medium ${w.tone}`}>
                          <Icon name={w.icon} size={16} />{w.word}
                        </span>
                        <span className="text-xs leading-snug text-muted-foreground">
                          {new Date(e.occurred_on).toLocaleDateString('en-IN',
                            { day: 'numeric', month: 'short', year: 'numeric' })}
                          {e.direction === 'written_off' && e.category ? ` · ${e.category}` : ''}
                          {e.direction !== 'written_off' && e.other_side ? ` · ${e.other_side}` : ''}
                          {e.note ? ` · ${e.note}` : ''}
                        </span>
                      </span>
                      <span className={`flex-none text-[15px] font-semibold tabular-nums ${w.tone}`}>
                        {e.direction === 'back' ? '−' : '+'}{format(Number(e.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="px-[var(--gutter)] text-[13px] leading-relaxed text-muted-foreground">
            None of this touches the monthly budget while it is outstanding — money lent has not
            been spent. Writing it off is the moment that changes.
          </p>
        </div>
      </main>
    </Screen>
  );
}
