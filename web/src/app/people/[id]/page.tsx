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

export const metadata = { title: 'Person · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const WORD = {
  lent: ['Lent', 'var(--foreground)'],
  back: ['Paid back', 'var(--primary)'],
  written_off: ['Written off', 'var(--destructive)'],
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

  return (
    <Screen>
      <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: BACK_SPACE }}>
        <PageHead back="/people" eyebrow="Loans" title={person.name}>
          <div className="flex flex-col gap-2 rounded-[22px] border border-border bg-card p-4">
            <span className="font-display text-[36px] leading-none tabular-nums">
              {balance === 0 && owedOnClaims === 0 ? 'Settled up' : format(Math.abs(balance) + owedOnClaims)}
            </span>
            {/* Lending and shared costs are different debts and are said apart —
                conflating them is what makes a khata stop being trusted. */}
            <p className="text-sm text-muted-foreground">
              {balance === 0 && owedOnClaims === 0
                ? `Nothing outstanding between you${person.phone ? ` · ${person.phone}` : ''}`
                : [
                    balance > 0 ? `${format(balance)} lent` : null,
                    balance < 0 ? `${format(-balance)} you owe` : null,
                    owedOnClaims > 0 ? `${format(owedOnClaims)} for shared costs` : null,
                  ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </PageHead>

        <div style={{ paddingTop: 20 }}>
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

          {ledger.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--gutter) 11px' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>Money lent and returned</h2>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {ledger.length === 0 ? (
            <p style={{
              margin: '10px 34px', textAlign: 'center', fontSize: 'var(--step--1)', lineHeight: 1.55,
              color: 'var(--muted-foreground)',
            }}>
              Nothing between you yet.
            </p>
          ) : (
            <section className="border border-border" style={{
              margin: '0 var(--gutter)', background: 'var(--card)', borderRadius: 18, padding: '0 var(--pad)',
            }}>
              {ledger.map((e, i) => {
                const [word, colour] = WORD[e.direction];
                return (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, minHeight: 70,
                    borderBottom: i === ledger.length - 1 ? undefined : '1px solid var(--border)',
                  }}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, color: colour }}>{word}</span>
                      <span style={{
                        fontSize: 'var(--step--1)', color: 'var(--muted-foreground)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {new Date(e.occurred_on).toLocaleDateString('en-IN',
                          { day: 'numeric', month: 'short', year: 'numeric' })}
                        {e.direction === 'written_off' && e.category ? ` · ${e.category}` : ''}
                        {e.direction !== 'written_off' && e.other_side ? ` · ${e.other_side}` : ''}
                        {e.note ? ` · ${e.note}` : ''}
                      </span>
                    </span>
                    <span className="t amt" style={{ fontSize: 'var(--step-0)', letterSpacing: '-.01em', color: colour }}>
                      {e.direction === 'back' ? '−' : '+'}{format(Number(e.amount))}
                    </span>
                  </div>
                );
              })}
            </section>
          )}

          <p style={{
            margin: '18px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)',
          }}>
            None of this touches the monthly budget while it is outstanding — money lent has not
            been spent. Writing it off is the moment that changes.
          </p>
        </div>
      </main>
    </Screen>
  );
}
