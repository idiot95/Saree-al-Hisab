'use client';

import { useActionState, useState } from 'react';
import { CurrencyField, Field, ErrorNote } from '../auth-ui';
import { CURRENCIES } from '@/lib/money';
import { setCurrency, startAnotherHousehold, switchTo, renameHousehold } from './actions';

type Book = { id: string; name: string; role: 'owner' | 'adult' | 'viewer'; active: boolean; people: number };

const ROLE = { owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer' } as const;

export default function BooksSwitcher({ books, canRename, currency, currencyFixed }: {
  books: Book[];
  canRename: boolean;
  /** What the books on screen are kept in … */
  currency: string;
  /** … and whether that is still open to change (only while they are empty). */
  currencyFixed: boolean;
}) {
  const [, switchAct] = useActionState(switchTo, null);
  const [newState, startAct, starting] = useActionState(startAnotherHousehold, null);
  const [renameState, renameAct, renaming] = useActionState(renameHousehold, null);
  const [ccyState, ccyAct, changingCcy] = useActionState(setCurrency, null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const ccy = CURRENCIES.find((c) => c.code === currency);
  const ccyLabel = ccy ? `${ccy.name} · ${ccy.symbol.trim()}` : currency;

  return (
    <section className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
    }}>
      {books.map((b, i) => (
        <div key={b.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
          borderBottom: '1px solid var(--c-rule)',
        }}>
          <span style={{
            width: 36, height: 36, flex: 'none', borderRadius: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--1)', fontWeight: 700,
            background: b.active ? 'var(--c-seagrass)' : 'var(--c-sunk)',
            color: b.active ? 'var(--c-on-fill)' : 'var(--c-meta)',
          }}>{b.name.slice(0, 2).toUpperCase()}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{b.name}</span>
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              {ROLE[b.role]} · {b.people} {b.people === 1 ? 'person' : 'people'}
            </span>
          </span>
          {b.active ? (
            <span style={{
              flex: 'none', fontSize: 'var(--step--2)', fontWeight: 700, padding: '6px 10px', borderRadius: 8,
              background: 'var(--c-ok-tint)', color: 'var(--c-ok)', letterSpacing: '.03em',
            }}>CURRENT</span>
          ) : (
            <form action={switchAct}>
              <input type="hidden" name="householdId" value={b.id} />
              <button className="cta" type="submit" style={{
                minHeight: 44, padding: '0 13px', borderRadius: 10, fontSize: 'var(--step--1)',
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
          <Field label="Household name" name="name"
            defaultValue={books.find((b) => b.active)?.name} required maxLength={60} autoFocus />
          {renameState && !renameState.ok && <ErrorNote>{renameState.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setEditing(false)} style={ghost}>Cancel</button>
            <button type="submit" disabled={renaming} style={{ ...solid, flex: 1 }}>
              {renaming ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} style={{
          ...row, borderBottom: '1px solid var(--c-rule)',
        }}>
          <Pencil />
          <span style={{ flex: 1 }}>Rename this household</span>
          {renameState?.ok && (
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-ok)', fontWeight: 600 }}>done</span>
          )}
        </button>
      ))}

      {/* The currency: a fact about the books, changeable only while they
          are empty. Once fixed it is a row that says so rather than a
          control that fails. */}
      {canRename && !currencyFixed && choosing ? (
        <form action={ccyAct} style={{
          display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0',
          borderBottom: '1px solid var(--c-rule)',
        }}>
          <CurrencyField defaultValue={currency} autoFocus
            hint="Every entry is recorded in this. It is fixed the moment the books hold one." />
          {ccyState && !ccyState.ok && <ErrorNote>{ccyState.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setChoosing(false)} style={ghost}>Cancel</button>
            <button type="submit" disabled={changingCcy} style={{ ...solid, flex: 1 }}>
              {changingCcy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : canRename && !currencyFixed ? (
        <button type="button" onClick={() => setChoosing(true)} style={{
          ...row, borderBottom: '1px solid var(--c-rule)',
        }}>
          <Coin />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>Currency</span>
            <span style={{ fontSize: 'var(--step--2)', fontWeight: 500, color: 'var(--c-meta)' }}>{ccyLabel}</span>
          </span>
          {ccyState?.ok && (
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-ok)', fontWeight: 600 }}>done</span>
          )}
        </button>
      ) : (
        <div style={{ ...row, borderBottom: '1px solid var(--c-rule)', cursor: 'default' }}>
          <Coin />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>Currency</span>
            <span style={{ fontSize: 'var(--step--2)', fontWeight: 500, color: 'var(--c-meta)' }}>
              {ccyLabel}{currencyFixed ? ' · fixed, the books hold entries' : ''}
            </span>
          </span>
        </div>
      )}

      {adding ? (
        <form action={startAct} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0' }}>
          <Field label="Household name" name="name" placeholder="The shop"
            required maxLength={60} autoFocus
            hint="A separate set of books. Nothing is shared between them." />
          <CurrencyField defaultValue={currency} />
          {newState && !newState.ok && <ErrorNote>{newState.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setAdding(false)} style={ghost}>Cancel</button>
            <button type="submit" disabled={starting} style={{ ...solid, flex: 1 }}>
              {starting ? 'Creating…' : 'Create household'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={row}>
          <Plus />
          <span style={{ flex: 1 }}>New household</span>
        </button>
      )}
    </section>
  );
}

const row: React.CSSProperties = {
  width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 11,
  textAlign: 'left', fontSize: 'var(--step-0)', fontWeight: 600, color: 'var(--c-ink)',
};
const ghost: React.CSSProperties = {
  minHeight: 46, padding: '0 var(--pad)', borderRadius: 11, fontSize: 'var(--step--1)',
  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const solid: React.CSSProperties = {
  minHeight: 46, borderRadius: 11, fontSize: 'var(--step-0)', fontWeight: 600,
  background: 'var(--g-primary)', color: 'var(--c-on-primary)',
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
const Coin = () => (
  <span style={icon}>
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5H9.5m0 0h5a1.75 1.75 0 0 1 0 3.5h-5M12 7.5v9" />
    </svg>
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
