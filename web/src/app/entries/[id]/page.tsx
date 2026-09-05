import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { actorOrNull, categoriesFor, entryById, methodsFor } from '@/db/queries';
import { HEADER_BG } from '../../auth-ui';
import EditEntry from './EditEntry';

export const metadata = { title: 'Entry · Quiet Ledger' };
export const dynamic = 'force-dynamic';

const KIND = {
  expense: 'Expense', income: 'Income', transfer: 'Transfer',
  card_payment: 'Card payment', claim_receipt: 'Money back', refund: 'Refund',
} as Record<string, string>;

export default async function Entry({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const entry = await entryById(actor.household_id, id);
  if (!entry) notFound();

  const [cats, methods] = await Promise.all([
    categoriesFor(actor.household_id),
    methodsFor(actor.household_id),
  ]);

  const recorded = new Date(entry.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 26px 26px',
        padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Link href="/entries" aria-label="Back to entries" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="t" style={{ margin: 0, fontSize: 24, letterSpacing: '-.018em' }}>
          {KIND[entry.kind] ?? 'Entry'}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.76)' }}>
          {entry.who} recorded this on {recorded}
          {entry.account && ` · ${entry.account}`}
        </p>
      </header>

      <div style={{ padding: '18px 0 0' }}>
        <EditEntry
          entry={{
            id: entry.id, kind: entry.kind, amount: entry.amount,
            occurred_on: new Date(entry.occurred_on).toISOString().slice(0, 10),
            merchant: entry.merchant, note: entry.note, is_shared: entry.is_shared,
            category_id: entry.category_id, payment_method_id: entry.payment_method_id,
          }}
          categories={cats.map((c) => ({ category_id: c.id, name: c.name, tint: c.tint }))}
          methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
          canEdit={actor.role !== 'viewer'}
        />

        {/* Tesler: the shape rules are real and cannot be wished away, so the
            app says which change it will not make rather than pretending. */}
        <p style={{
          margin: '18px 20px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          To change what kind of entry this is, delete it and add it again — an expense and a
          transfer follow different rules, and quietly rewriting one into the other is how a
          ledger starts disagreeing with itself.
        </p>
      </div>
    </main>
  );
}
