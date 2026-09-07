'use client';

import { useActionState, useState } from 'react';
import { Icon, Chip, tintOf } from '../Icon';
import { ErrorNote } from '../auth-ui';
import {
  addCategory, editCategory, retireCategory, restoreCategory, moveCategory,
} from './actions';
import { ICONS, TINTS } from './options';

type Cat = {
  id: string; name: string; icon: string; tint: string;
  archived: boolean; entries: number; budgeted_months: number;
};

/* Picking an icon and a colour is the whole point of the screen, so both are
   shown as themselves rather than named in a dropdown. Twenty-five glyphs is
   past what Hick's law would want in one glance, so they scroll in a grid
   where scanning replaces deciding. */
function Picker({ icon, tint, onIcon, onTint }: {
  icon: string; tint: string; onIcon: (v: string) => void; onTint: (v: string) => void;
}) {
  return (
    <>
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="tint" value={tint} />

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          Colour
        </legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TINTS.map((t) => {
            const [bg, ink] = tintOf(t);
            const on = t === tint;
            return (
              <button key={t} type="button" onClick={() => onTint(t)}
                aria-label={t} aria-pressed={on}
                style={{
                  width: 44, height: 44, borderRadius: 999, background: bg,
                  border: `2px solid ${on ? ink : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink,
                }}>
                {on && (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l5 5 9-11" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          Icon
        </legend>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: 7,
          maxHeight: 200, overflowY: 'auto',
        }}>
          {ICONS.map((n) => {
            const on = n === icon;
            const [bg, ink] = tintOf(tint);
            return (
              <button key={n} type="button" onClick={() => onIcon(n)}
                aria-label={n} aria-pressed={on}
                style={{
                  minHeight: 46, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? bg : 'var(--c-sunk2)',
                  color: on ? ink : 'var(--c-meta)',
                  border: `1px solid ${on ? ink : 'var(--c-border)'}`,
                }}>
                <Icon name={n} size={20} />
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}

function NameField({ defaultValue }: { defaultValue?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>Name</span>
      <input name="name" defaultValue={defaultValue} required maxLength={40}
        placeholder="Groceries" style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
          background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 16, padding: '0 14px',
        }} />
    </label>
  );
}

export default function CategoryEditor({ categories, canEdit }: {
  categories: Cat[]; canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const live = categories.filter((c) => !c.archived);
  const retired = categories.filter((c) => c.archived);

  return (
    <>
      <Head>In use</Head>
      <section className="el" style={card}>
        {live.map((c, i) => (
          editing === c.id
            ? <EditRow key={c.id} cat={c} onDone={() => setEditing(null)} />
            : <Row key={c.id} cat={c} first={i === 0} last={i === live.length - 1}
                canEdit={canEdit} onEdit={() => setEditing(c.id)} />
        ))}
      </section>

      {canEdit && (adding
        ? <AddRow onDone={() => setAdding(false)} />
        : (
          <button type="button" onClick={() => setAdding(true)} className="el" style={{
            margin: '0 18px 22px', width: 'calc(100% - 36px)', minHeight: 56, borderRadius: 16,
            display: 'flex', alignItems: 'center', gap: 11, padding: '0 16px',
            background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
            color: 'var(--c-ink)', fontSize: 15, fontWeight: 600,
          }}>
            <span style={{
              width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            </span>
            Add a category
          </button>
        ))}

      {retired.length > 0 && (
        <>
          <Head>Retired</Head>
          <p style={{ margin: '-4px 20px 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            Not offered for new entries. Everything already filed under them is untouched, and
            they still appear in the months they were used.
          </p>
          <section className="el" style={card}>
            {retired.map((c, i) => (
              <RetiredRow key={c.id} cat={c} last={i === retired.length - 1} canEdit={canEdit} />
            ))}
          </section>
        </>
      )}
    </>
  );
}

function Row({ cat, first, last, canEdit, onEdit }: {
  cat: Cat; first: boolean; last: boolean; canEdit: boolean; onEdit: () => void;
}) {
  const [, move] = useActionState(moveCategory, null);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 72,
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <Chip icon={cat.icon} tint={cat.tint} size={40} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600 }}>{cat.name}</span>
        <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
          {cat.entries === 0 ? 'nothing filed here yet'
            : `${cat.entries} ${cat.entries === 1 ? 'entry' : 'entries'}`}
          {cat.budgeted_months > 0 && ` · budgeted in ${cat.budgeted_months} ${cat.budgeted_months === 1 ? 'month' : 'months'}`}
        </span>
      </span>
      {canEdit && (
        <>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            {[['up', !first], ['down', !last]].map(([dir, enabled]) => (
              <form key={dir as string} action={move}>
                <input type="hidden" name="id" value={cat.id} />
                <input type="hidden" name="direction" value={dir as string} />
                <button type="submit" disabled={!enabled}
                  aria-label={dir === 'up' ? `Move ${cat.name} up` : `Move ${cat.name} down`}
                  style={{
                    width: 34, height: 22, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: enabled ? 'var(--c-meta)' : 'var(--c-off)',
                    background: 'transparent',
                  }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
                  </svg>
                </button>
              </form>
            ))}
          </span>
          <button type="button" onClick={onEdit} style={{
            minHeight: 44, padding: '0 12px', borderRadius: 11, fontSize: 13.5, fontWeight: 600,
            background: 'var(--c-sunk)', color: 'var(--c-ink)',
          }}>Edit</button>
        </>
      )}
    </div>
  );
}

function EditRow({ cat, onDone }: { cat: Cat; onDone: () => void }) {
  const [state, act, pending] = useActionState(editCategory, null);
  const [retireState, retire, retiring] = useActionState(retireCategory, null);
  const [icon, setIcon] = useState(cat.icon);
  const [tint, setTint] = useState(cat.tint);

  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <input type="hidden" name="id" value={cat.id} />
        <NameField defaultValue={cat.name} />
        <Picker icon={icon} tint={tint} onIcon={setIcon} onTint={setTint} />
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" onClick={onDone} style={ghost}>Cancel</button>
          <button type="submit" disabled={pending} style={solid}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <form action={retire} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input type="hidden" name="id" value={cat.id} />
        <button type="submit" disabled={retiring} style={{
          minHeight: 44, borderRadius: 11, fontSize: 13.5, fontWeight: 600,
          background: 'transparent', color: 'var(--c-danger)',
        }}>{retiring ? 'Retiring…' : 'Retire this category'}</button>
        {retireState && !retireState.ok && (
          <span role="alert" style={{ fontSize: 12.5, color: 'var(--c-danger)' }}>
            {retireState.error}
          </span>
        )}
        <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)' }}>
          It stops being offered for new entries. Nothing already filed under it moves, and no
          month changes value.
        </span>
      </form>
    </div>
  );
}

function AddRow({ onDone }: { onDone: () => void }) {
  const [state, act, pending] = useActionState(addCategory, null);
  const [icon, setIcon] = useState<string>('tag');
  const [tint, setTint] = useState<string>('blue');

  return (
    <form action={act} className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <NameField />
      <Picker icon={icon} tint={tint} onIcon={setIcon} onTint={setTint} />
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div style={{ display: 'flex', gap: 9 }}>
        <button type="button" onClick={onDone} style={ghost}>Cancel</button>
        <button type="submit" disabled={pending} style={solid}>
          {pending ? 'Adding…' : 'Add category'}
        </button>
      </div>
    </form>
  );
}

function RetiredRow({ cat, last, canEdit }: { cat: Cat; last: boolean; canEdit: boolean }) {
  const [, restore] = useActionState(restoreCategory, null);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 68, opacity: 0.7,
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <Chip icon={cat.icon} tint={cat.tint} size={36} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</span>
        <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
          {cat.entries} {cat.entries === 1 ? 'entry' : 'entries'} kept
        </span>
      </span>
      {canEdit && (
        <form action={restore}>
          <input type="hidden" name="id" value={cat.id} />
          <button type="submit" style={{
            minHeight: 44, padding: '0 12px', borderRadius: 11, fontSize: 13.5,
            fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-ink)',
          }}>Bring back</button>
        </form>
      )}
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
const ghost: React.CSSProperties = {
  minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 14.5, fontWeight: 600,
  background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const solid: React.CSSProperties = {
  flex: 1, minHeight: 50, borderRadius: 13, fontSize: 15.5, fontWeight: 600,
  background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
};
