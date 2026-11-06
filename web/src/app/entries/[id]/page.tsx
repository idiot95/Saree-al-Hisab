import { Icon } from '../../Icon';
import { notFound, redirect } from 'next/navigation';
import {
  actorOrNull, attachmentsFor, categoriesFor, claimsOnEntry, entryById, peopleFor,
} from '@/db/queries';
import { withHousehold } from '@/db/client';
import { waysToPay } from '@/db/payment';
import EditEntry from './EditEntry';
import OwedFor from './OwedFor';
import PageHead from '../../PageHead';
import { TAB_BAR_SPACE } from '../../tabs';
import TabBar from '../../TabBar';
import Screen from '../../Screen';

export const metadata = { title: 'Entry · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const KIND = {
  expense: 'Expense', income: 'Income', transfer: 'Transfer',
  card_payment: 'Card payment', claim_receipt: 'Money back', refund: 'Refund',
  adjust_in: 'Balance adjustment', adjust_out: 'Balance adjustment',
} as Record<string, string>;

/* Where Back and Save return to: the screen the entry was opened from, when it
   is one of ours. A tab's entry goes back to its tab, not to Entries. */
const FROM = /^\/(?:|entries|accounts|people|tab\/[0-9a-f-]{36}|people\/[0-9a-f-]{36})$/;

export default async function Entry({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  const { from } = await searchParams;
  const back = from && FROM.test(from) ? from : '/entries';
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const entry = await entryById(actor.household_id, id);
  if (!entry) notFound();

  const hh = actor.household_id;
  const [cats, ways, people, claims, bills] = await withHousehold(hh, () => Promise.all([
    categoriesFor(hh),
    waysToPay(hh),
    peopleFor(hh),
    claimsOnEntry(hh, entry.id),
    attachmentsFor(hh, entry.id),
  ]));

  const recorded = new Date(entry.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <Screen>
      <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back={back} eyebrow="Activity" title={KIND[entry.kind] ?? 'Entry'}
          sub={<>{entry.who} recorded this on {recorded}{entry.account && ` · ${entry.account}`}</>} />

        <div style={{ padding: '18px 0 0' }}>
          <EditEntry
            entry={{
              id: entry.id, kind: entry.kind, amount: entry.amount,
              occurred_on: new Date(entry.occurred_on).toISOString().slice(0, 10),
              merchant: entry.merchant, note: entry.note, is_shared: entry.is_shared,
              category_id: entry.category_id, account_id: entry.account_id,
              payment_method_id: entry.payment_method_id,
              counts_as_spend: entry.counts_as_spend,
              owed: entry.kind === 'expense' && (!!entry.book_id || claims.length > 0),
              reconciled_on: entry.reconciled_on,
            }}
            back={back}
            categories={cats}
            ways={ways}
            canEdit={actor.role !== 'viewer'}
          />

          {entry.kind === 'expense' && (
            <OwedFor
              txnId={entry.id} entryAmount={Number(entry.amount)}
              people={people.map((p) => ({ id: p.id, name: p.name }))}
              claims={claims} canEdit={actor.role !== 'viewer'}
            />
          )}

          {bills.length > 0 && (
            <section aria-label="Bills kept with this entry" style={{
              margin: '18px var(--gutter) 0', display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <span style={{
                fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.06em',
                textTransform: 'uppercase', color: 'var(--muted-foreground)',
              }}>Bills</span>
              {bills.map((b) => (
                <a key={b.id} href={`/attachment/${b.id}`} target="_blank" rel="noopener noreferrer"
                  className="border border-border" style={{
                    minHeight: 52, padding: '8px 12px', borderRadius: 13, display: 'flex',
                    alignItems: 'center', gap: 10, background: 'var(--card)',
                    color: 'var(--foreground)', textDecoration: 'none',
                  }}>
                  <Icon name={b.mime === 'application/pdf' ? 'invoice' : 'camera'} size={17} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.name}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                    {Math.max(1, Math.round(b.bytes / 1024))} KB
                  </span>
                </a>
              ))}
            </section>
          )}

          {/* Tesler: the shape rules are real and cannot be wished away, so the
              app says which change it will not make rather than pretending. */}
          <p style={{
            margin: '18px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)',
          }}>
            To change what kind of entry this is, delete it and add it again — an expense and a
            transfer follow different rules, and quietly rewriting one into the other is how a
            ledger starts disagreeing with itself.
          </p>
        </div>
        <TabBar current="/entry" />
      </main>
    </Screen>
  );
}
