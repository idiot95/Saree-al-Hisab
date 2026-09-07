import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { actorOrNull, bookById, peopleForBook } from '@/db/queries';
import { format } from '@/lib/money';
import { headerBg } from '../../auth-ui';
import BookMembers from './BookMembers';
import Screen from '../../Screen';
import SwipeBack from '../../SwipeBack';

export const metadata = { title: 'Book · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Book({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const book = await bookById(actor.household_id, id);
  if (!book) notFound();
  const people = await peopleForBook(actor.household_id, book.id);

  const members = people.filter((p) => p.in_book);
  const lent = members.reduce((n, p) => n + Number(p.lent), 0);
  const claimed = members.reduce((n, p) => n + Number(p.claimed), 0);
  const total = lent + claimed;

  return (
    <Screen>
      <SwipeBack to="/people" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
        <header className="el2" style={{
          background: headerBg('purple'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/people" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <span style={{
            alignSelf: 'flex-start', fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.05em',
            padding: '5px 10px', borderRadius: 7, background: 'rgba(255,255,255,.16)',
          }}>
            {book.kind === 'loan' ? 'LENDING BOOK' : 'SHARED COSTS BOOK'}
            {book.closed_at && ' · CLOSED'}
          </span>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            {book.name}
          </h1>
          <span className="t" style={{ fontSize: 'var(--step-4)', letterSpacing: '-.022em' }}>
            {total === 0 ? 'Settled up' : format(Math.abs(total))}
          </span>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            {members.length === 0
              ? 'Add people and this adds up what they owe between them.'
              : [
                  lent !== 0 ? `${format(Math.abs(lent))} lent` : null,
                  claimed > 0 ? `${format(claimed)} for shared costs` : null,
                  `${members.length} ${members.length === 1 ? 'person' : 'people'}`,
                ].filter(Boolean).join(' · ')}
          </p>
          {book.note && (
            <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.7)' }}>{book.note}</p>
          )}
        </header>

        <div style={{ paddingTop: 20 }}>
          <BookMembers
            bookId={book.id} people={people} closed={!!book.closed_at}
            canEdit={actor.role !== 'viewer'}
          />
          <p style={{
            margin: '18px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
          }}>
            A book is a folder for people. It changes nothing about the arithmetic — the same
            loans and the same claims, added up in one place so you can answer &ldquo;where do we
            stand on this&rdquo; without doing it in your head.
          </p>
        </div>
      </main>
    </Screen>
  );
}
