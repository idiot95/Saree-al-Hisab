'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { startAnotherHousehold, switchTo, renameHousehold } from './actions';

type Book = { id: string; name: string; role: 'owner' | 'adult' | 'viewer'; active: boolean; people: number };

const ROLE = { owner: 'you own these', adult: 'you write in these', viewer: 'you only watch these' } as const;

export default function BooksSwitcher({ books, canRename }: { books: Book[]; canRename: boolean }) {
  const [, switchAct] = useActionState(switchTo, null);
  const [newState, startAct, starting] = useActionState(startAnotherHousehold, null);
  const [renameState, renameAct, renaming] = useActionState(renameHousehold, null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <section className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
    }}>
      {books.map((b, i) => (
        <div key={b.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
          borderBottom: '1px solid var(--c-rule)',
        }}>
          <span style={{
            width: 36, height: 36, flex: 'none', borderRadius: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
            background: b.active ? 'var(--c-seagrass)' : 'var(--c-sunk)',
            color: b.active ? 'var(--c-on-fill)' : 'var(--c-meta)',
          }}>{b.name.slice(0, 2).toUpperCase()}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 15, fontWeight: 600, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{b.name}</span>
            <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
              {ROLE[b.role]} · {b.people} {b.people === 1 ? 'person' : 'people'}
            </span>
          </span>
          {b.active ? (
            <span style={{
              flex: 'none', fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
              background: 'var(--c-ok-tint)', color: 'var(--c-ok)', letterSpacing: '.03em',
            }}>ON SCREEN</span>
          ) : (
            <form action={switchAct}>
              <input type="hidden" name="householdId" value={b.id} />
              <button type="submit" style={{
                minHeight: 44, padding: '0 13px', borderRadius: 10, fontSize: 13.5,
                fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-ink)',
              }}>Open</button>
            </form>
          )}
        </div>
      ))}

      {canRename && (editing ? (
        <form action={renameAct} style={{
          display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0',
          borderBottom: '1px solid var(--c-rule)',
        }}>
          <Field label="Call these books something else" name="name"
            defaultValue={books.find((b) => b.active)?.name} required maxLength={60} autoFocus />
          {renameState && !renameState.ok && <ErrorNote>{renameState.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setEditing(false)} style={ghost}>Leave it</button>
            <button type="submit" disabled={renaming} style={{ ...solid, flex: 1 }}>
              {renaming ? 'Renaming…' : 'Rename'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} style={{
          ...row, borderBottom: '1px solid var(--c-rule)',
        }}>
          <Pencil />
          <span style={{ flex: 1 }}>Rename these books</span>
          {renameState?.ok && (
            <span style={{ fontSize: 12, color: 'var(--c-ok)', fontWeight: 600 }}>done</span>
          )}
        </button>
      ))}

      {adding ? (
        <form action={startAct} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0' }}>
          <Field label="Name for the new set" name="name" placeholder="The flat, the shop, Ammi’s"
            required maxLength={60} autoFocus
            hint="Completely separate books. Nothing crosses over, which is rather the point." />
          {newState && !newState.ok && <ErrorNote>{newState.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setAdding(false)} style={ghost}>Never mind</button>
            <button type="submit" disabled={starting} style={{ ...solid, flex: 1 }}>
              {starting ? 'Ruling the columns…' : 'Start them'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={row}>
          <Plus />
          <span style={{ flex: 1 }}>Start another set of books</span>
        </button>
      )}
    </section>
  );
}

const row: React.CSSProperties = {
  width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 11,
  textAlign: 'left', fontSize: 14.5, fontWeight: 600, color: 'var(--c-ink)',
};
const ghost: React.CSSProperties = {
  minHeight: 46, padding: '0 15px', borderRadius: 11, fontSize: 14,
  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const solid: React.CSSProperties = {
  minHeight: 46, borderRadius: 11, fontSize: 14.5, fontWeight: 600,
  background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
};

const icon = { width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: 'var(--c-sunk)', color: 'var(--c-meta)' } as React.CSSProperties;

const Plus = () => (
  <span style={icon}>
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
  </span>
);
const Pencil = () => (
  <span style={icon}>
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </svg>
  </span>
);
