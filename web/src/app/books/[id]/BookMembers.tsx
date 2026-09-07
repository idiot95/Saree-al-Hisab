'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { addToBook, removeFromBook, toggleBookClosed, deleteBook } from '../actions';
import { format } from '@/lib/money';

type Person = {
  id: string; name: string; tint: string; in_book: boolean;
  lent: string; claimed: string; open_claims: number;
};

const TINT: Record<string, [string, string]> = {
  green: ['var(--cat-green)', 'var(--cat-green-ink)'],
  orange: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  blue: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
  pink: ['var(--cat-pink)', 'var(--cat-pink-ink)'],
  cyan: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
  rust: ['var(--cat-rust)', 'var(--cat-rust-ink)'],
  indigo: ['var(--cat-indigo)', 'var(--cat-indigo-ink)'],
};

export default function BookMembers({ bookId, people, closed, canEdit }: {
  bookId: string; people: Person[]; closed: boolean; canEdit: boolean;
}) {
  const [, add] = useActionState(addToBook, null);
  const [, drop] = useActionState(removeFromBook, null);
  const [closeState, toggle, toggling] = useActionState(toggleBookClosed, null);
  const [, remove] = useActionState(deleteBook, null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const inBook = people.filter((p) => p.in_book);
  const rest = people.filter((p) => !p.in_book);

  return (
    <>
      <Head>{inBook.length === 0 ? 'Nobody in this book yet' : 'In this book'}</Head>
      {inBook.length > 0 && (
        <section className="el" style={card}>
          {inBook.map((p, i) => (
            <Row key={p.id} p={p} last={i === inBook.length - 1}>
              {canEdit && (
                <form action={drop}>
                  <input type="hidden" name="bookId" value={bookId} />
                  <input type="hidden" name="counterpartyId" value={p.id} />
                  <button type="submit" style={quiet}>Remove</button>
                </form>
              )}
            </Row>
          ))}
        </section>
      )}

      {canEdit && (adding ? (
        <section className="el" style={{ ...card, paddingTop: 4, paddingBottom: 4 }}>
          {rest.length === 0 ? (
            <p style={{ margin: 0, padding: '18px 0', textAlign: 'center', fontSize: 13.5, color: 'var(--c-meta)' }}>
              Everyone is already in this book.
            </p>
          ) : rest.map((p, i) => (
            <Row key={p.id} p={p} last={i === rest.length - 1}>
              <form action={add}>
                <input type="hidden" name="bookId" value={bookId} />
                <input type="hidden" name="counterpartyId" value={p.id} />
                <button type="submit" style={{
                  minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 13.5,
                  fontWeight: 600, background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
                }}>Add</button>
              </form>
            </Row>
          ))}
          <button type="button" onClick={() => setAdding(false)} style={{
            width: '100%', minHeight: 48, fontSize: 14, fontWeight: 600,
            color: 'var(--c-meta)', background: 'transparent',
          }}>Done</button>
        </section>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="el" style={{
          margin: '0 18px 22px', width: 'calc(100% - 36px)', minHeight: 54, borderRadius: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
          color: 'var(--c-ink)', fontSize: 15, fontWeight: 600,
        }}>Add someone to this book</button>
      ))}

      {canEdit && (
        <div style={{ margin: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <form action={toggle}>
            <input type="hidden" name="bookId" value={bookId} />
            <button type="submit" disabled={toggling} style={{
              width: '100%', minHeight: 50, borderRadius: 13, fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)', opacity: toggling ? 0.6 : 1,
            }}>{closed ? 'Reopen this book' : 'Close this book'}</button>
          </form>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)' }}>
            Closing files it away. Nothing about what anyone owes changes — a closed book with
            money still outstanding is a perfectly ordinary thing.
          </p>
          {closeState && !closeState.ok && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--c-danger)' }}>
              {closeState.error}
            </p>
          )}

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} style={{
              minHeight: 46, fontSize: 13.5, fontWeight: 600, color: 'var(--c-danger)',
              background: 'transparent',
            }}>Delete this book</button>
          ) : (
            <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="hidden" name="bookId" value={bookId} />
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'var(--c-meta)' }}>
                Only the folder goes. Every person, every loan and every claim stays exactly
                where it is.
              </p>
              <div style={{ display: 'flex', gap: 9 }}>
                <button type="button" onClick={() => setConfirming(false)} style={{
                  minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 14,
                  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, minHeight: 48, borderRadius: 12, fontSize: 14.5, fontWeight: 600,
                  background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
                }}>Delete the book</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

function Row({ p, last, children }: { p: Person; last: boolean; children?: React.ReactNode }) {
  const [bg, ink] = TINT[p.tint] ?? ['var(--cat-neutral)', 'var(--cat-neutral-ink)'];
  const lent = Number(p.lent); const claimed = Number(p.claimed);
  const total = lent + claimed;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 72,
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <span style={{
        width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 700,
        background: bg, color: ink,
      }}>{p.name.slice(0, 2).toUpperCase()}</span>
      <Link href={`/people/${p.id}`} style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
        textDecoration: 'none', color: 'var(--c-ink)',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
        <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
          {total === 0 ? 'settled up'
            : [lent !== 0 ? `${format(Math.abs(lent))} lent` : null,
               claimed > 0 ? `${format(claimed)} shared` : null].filter(Boolean).join(' · ')}
        </span>
      </Link>
      {total !== 0 && (
        <span className="t" style={{
          fontSize: 15.5, color: total > 0 ? 'var(--c-ink)' : 'var(--c-danger)',
        }}>{format(Math.abs(total))}</span>
      )}
      {children}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600 }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

const card: React.CSSProperties = {
  margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
};
const quiet: React.CSSProperties = {
  minHeight: 44, padding: '0 10px', fontSize: 13, fontWeight: 600,
  color: 'var(--c-meta)', background: 'transparent',
};
