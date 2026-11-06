'use client';

import { useActionState, useState } from 'react';
import { CurrencyField, Field, ErrorNote } from '../auth-ui';
import { CURRENCIES } from '@/lib/money';
import { setCurrency, startAnotherHousehold, switchTo, renameHousehold } from './actions';
import { Icon } from '../Icon';
import { Card, Chevron, ghost, Glyph, row, solid, Words } from './rows';
import { useKeepOnRefusal, useOnSuccess } from '../worth/fields';
import { Said } from '../form-bits';

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
  // These post directly; a refusal's form reset is undone so the currency picked (and the name typed) stay.
  const keepNew = useKeepOnRefusal(newState);
  const keepName = useKeepOnRefusal(renameState);
  const keepCcy = useKeepOnRefusal(ccyState);
  /* Saved: these two stay open, saying Done beside their buttons (and on the row once shut), and each is redrawn
     (a new key) so its field starts again from the saved name or currency, rather than from what React's
     post-success reset left in the DOM. */
  const [nameRound, setNameRound] = useState(0);
  const [ccyRound, setCcyRound] = useState(0);
  /* What a save did, said in a live region that is mounted before the text changes and sits outside the keyed
     forms (one inside a form that was just redrawn is often not read). Cleared on each submit, so saving the same
     thing twice is said twice. */
  const [said, setSaid] = useState('');
  useOnSuccess(renameState, () => { setNameRound((r) => r + 1); setSaid('Household name saved.'); });
  useOnSuccess(ccyState, () => { setCcyRound((r) => r + 1); setSaid('Currency saved.'); });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const ccy = CURRENCIES.find((c) => c.code === currency);
  const ccyLabel = ccy ? `${ccy.name} · ${ccy.symbol.trim()}` : currency;

  return (
    <>
    <Said>{said}</Said>
    <Card>
      {books.map((b) => (
        <div key={b.id} className="flex min-h-16 items-center gap-3 px-[var(--pad)] py-2.5">
          <span className={`grid size-[38px] flex-none place-items-center rounded-[10px] text-sm font-bold ${b.active
            ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {b.name.slice(0, 2).toUpperCase()}
          </span>
          <Words title={b.name} sub={`${ROLE[b.role]} · ${b.people} ${b.people === 1 ? 'person' : 'people'}`} />
          {b.active ? (
            <span className="inline-flex flex-none items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-accent-foreground">
              <Icon name="check" size={15} />Current
            </span>
          ) : (
            <form action={switchAct} className="flex-none">
              <input type="hidden" name="householdId" value={b.id} />
              <button type="submit"
                className="press flex min-h-11 items-center rounded-xl bg-muted px-3.5 text-sm font-semibold text-foreground in-data-[platform=android]:min-h-12">
                Open
              </button>
            </form>
          )}
        </div>
      ))}

      {canRename && (editing ? (
        <form key={nameRound} action={renameAct} {...keepName} onSubmit={() => { setSaid(''); keepName.onSubmit(); }} className="flex flex-col gap-3 px-[var(--pad)] py-4">
          <Field label="Household name" name="name"
            defaultValue={books.find((b) => b.active)?.name} required maxLength={60} autoFocus />
          {renameState && !renameState.ok && <ErrorNote>{renameState.error}</ErrorNote>}
          {renameState?.ok && <DoneWord />}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={ghost}>Cancel</button>
            <button type="submit" disabled={renaming} className={solid}>
              {renaming ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={row}>
          <Glyph name="edit" />
          <Words title="Rename this household" />
          {renameState?.ok && <DoneWord />}
          <Chevron />
        </button>
      ))}

      {/* The currency: a fact about the books, changeable only while they
          are empty. Once fixed it is a row that says so rather than a
          control that fails. */}
      {canRename && !currencyFixed && choosing ? (
        <form key={ccyRound} action={ccyAct} {...keepCcy} onSubmit={() => { setSaid(''); keepCcy.onSubmit(); }} className="flex flex-col gap-3 px-[var(--pad)] py-4">
          <CurrencyField defaultValue={currency} autoFocus
            hint="Every entry is recorded in this. It is fixed the moment the books hold one." />
          {ccyState && !ccyState.ok && <ErrorNote>{ccyState.error}</ErrorNote>}
          {ccyState?.ok && <DoneWord />}
          <div className="flex gap-2">
            <button type="button" onClick={() => setChoosing(false)} className={ghost}>Cancel</button>
            <button type="submit" disabled={changingCcy} className={solid}>
              {changingCcy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : canRename && !currencyFixed ? (
        <button type="button" onClick={() => setChoosing(true)} className={row}>
          <Glyph name="coin" />
          <Words title="Currency" sub={ccyLabel} />
          {ccyState?.ok && <DoneWord />}
          <Chevron />
        </button>
      ) : (
        <div className="flex min-h-14 items-center gap-3 px-[var(--pad)] py-2.5">
          <Glyph name="coin" />
          <Words title="Currency" sub={<>{ccyLabel}{currencyFixed ? ' · fixed, the books hold entries' : ''}</>} />
          {currencyFixed && <Icon name="lock" size={18} className="flex-none text-muted-foreground" />}
        </div>
      )}

      {adding ? (
        <form action={startAct} {...keepNew} className="flex flex-col gap-3 px-[var(--pad)] py-4">
          <Field label="Household name" name="name" placeholder="The shop"
            required maxLength={60} autoFocus
            hint="A separate set of books. Nothing is shared between them." />
          <CurrencyField defaultValue={currency} />
          {newState && !newState.ok && <ErrorNote>{newState.error}</ErrorNote>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className={ghost}>Cancel</button>
            <button type="submit" disabled={starting} className={solid}>
              {starting ? 'Creating…' : 'Create household'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={row}>
          <Glyph name="add" />
          <Words title="New household" />
          <Chevron />
        </button>
      )}
    </Card>
    </>
  );
}

/** "done" after a save, with its check. */
const DoneWord = () => (
  <span className="inline-flex flex-none items-center gap-1 text-[13px] font-semibold text-primary">
    <Icon name="check" size={15} />Done
  </span>
);
