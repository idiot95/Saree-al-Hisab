'use client';

import { useActionState, useCallback, useRef, useState, useTransition } from 'react';
import { Icon, Chip, tintOf } from '../Icon';
import { ErrorNote } from '../auth-ui';
import SwipeRow from '../SwipeRow';
import Snack, { type SnackState } from '../Snack';
import { haptic } from '../haptics';
import {
  addCategory, editCategory, retireCategory, restoreCategory, moveCategory, reorderCategories,
} from './actions';
import { ICONS, TINTS } from './options';
import { Segmented } from '../DatePick';
import { SCOPE_LABEL, type Scope } from '@/lib/scope';
import Suggested from './Suggested';

type Cat = {
  id: string; name: string; icon: string; tint: string; scope: Scope; parent_id: string | null;
  children: number; archived: boolean; entries: number; budgeted_months: number;
};

/* A category may sit under one other — Milk under Groceries — and no deeper.
   The list shows each family as a block: the parent's row, then its children
   indented beneath it, and the block drags as one. */
type Parent = { id: string; name: string; scope: Scope };

/* Picking an icon and a colour is the whole point of the screen, so both are
   shown as themselves rather than named in a dropdown. A hundred and more
   glyphs is far past what Hick's law would want in one glance, so they sit
   in a scrolling grid with a search box above it: type "mil" and the grid
   is milk. The names are the search index, so it works offline and costs
   nothing. */
function Picker({ icon, tint, onIcon, onTint }: {
  icon: string; tint: string; onIcon: (v: string) => void; onTint: (v: string) => void;
}) {
  const [find, setFind] = useState('');
  const q = find.trim().toLowerCase();
  const shown = q ? ICONS.filter((n) => n.includes(q) || n === icon) : ICONS;
  return (
    <>
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="tint" value={tint} />

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          Colour
        </legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TINTS.map((t) => {
            const [bg, ink] = tintOf(t);
            const on = t === tint;
            return (
              <button key={t} type="button" onClick={() => { haptic('tap'); onTint(t); }}
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
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          Icon
        </legend>
        <input type="search" value={find} onChange={(e) => setFind(e.target.value)}
          placeholder="Find an icon" aria-label="Find an icon" autoComplete="off"
          style={{
            minHeight: 44, borderRadius: 12, border: '1px solid var(--c-border)',
            background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)', padding: '0 12px',
          }} />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))', gap: 7,
          maxHeight: 200, overflowY: 'auto',
        }}>
          {shown.length === 0 && (
            <span style={{ gridColumn: '1 / -1', fontSize: 'var(--step--1)', color: 'var(--c-meta)', padding: '8px 0' }}>
              Nothing called that. Try another word.
            </span>
          )}
          {shown.map((n) => {
            const on = n === icon;
            const [bg, ink] = tintOf(tint);
            return (
              <button key={n} type="button" onClick={() => { haptic('tap'); onIcon(n); }}
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

/* "Under" is a select, not chips: it is chosen once per category, and the
   list of parents is exactly the kind of short, named list a select was made
   for. A category with children of its own cannot itself move under another,
   and says so instead of offering a disabled control with no explanation. */
function UnderField({ parents, value, onChange, locked }: {
  parents: Parent[]; value: string; onChange: (id: string) => void; locked?: boolean;
}) {
  if (parents.length === 0 && !locked) return null;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Under</span>
      {locked ? (
        <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)', padding: '4px 0' }}>
          It has categories under it, so it stays at the top level.
        </span>
      ) : (
        <select name="parentId" value={value} onChange={(e) => onChange(e.target.value)} style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
          background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)', padding: '0 14px',
        }}>
          <option value="">On its own</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
    </label>
  );
}

/* What files under it. Spending and income are kept apart because a salary
   under Groceries is a mistake the app can prevent at the point of choosing,
   and because the budget is a limit on spending only. A child has no say:
   it takes its parent's scope, and the form says so instead of offering a
   control the server would overrule. */
const SCOPES = [['expense', SCOPE_LABEL.expense], ['income', SCOPE_LABEL.income], ['both', SCOPE_LABEL.both]] as const;
function ScopeField({ value, onChange, parent }: {
  value: Scope; onChange: (v: Scope) => void; parent: Parent | null;
}) {
  return (
    <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Files</span>
      {parent ? (
        <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)', padding: '4px 0' }}>
          {SCOPE_LABEL[parent.scope].toLowerCase()}, the same as {parent.name}.
        </span>
      ) : (
        <Segmented name="scope" value={value} options={SCOPES} onChange={onChange} label="Spending, income, or both" />
      )}
    </div>
  );
}

function NameField({ defaultValue }: { defaultValue?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Name</span>
      <input name="name" defaultValue={defaultValue} required maxLength={40}
        placeholder="Groceries" style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
          background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)', padding: '0 14px',
        }} />
    </label>
  );
}

/* Drag a row by its grip to reorder.

   The grip is the affordance: six dots at the end of a row is what "you can
   drag this" has looked like on every platform since the iPod, so nothing has
   to be explained. Press it and the row lifts at once — no long-press to
   discover — and the others step out of its way with a click at each
   position it passes, so the count is felt as well as seen. The list scrolls
   normally everywhere else; only the grip refuses to (`touch-action: none`).

   Positions are measured once, when the drag starts, and everything after is
   a transform: no layout runs while a finger is down. */
function useReorder(ids: string[], onCommit: (ids: string[]) => void) {
  const rows = useRef(new Map<string, HTMLElement>());
  const [drag, setDrag] = useState<{ id: string; from: number; to: number; dy: number; h: number } | null>(null);
  const st = useRef({ pid: -1, sy: 0, tops: [] as number[], hs: [] as number[], from: 0, to: 0 });

  const bind = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el); else rows.current.delete(id);
  }, []);

  const grip = (id: string) => ({
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const from = ids.indexOf(id);
      if (from < 0) return;
      const rects = ids.map((k) => rows.current.get(k)?.getBoundingClientRect());
      if (rects.some((r) => !r)) return;
      st.current = {
        pid: e.pointerId, sy: e.clientY, from, to: from,
        tops: rects.map((r) => r!.top), hs: rects.map((r) => r!.height),
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      haptic('select');
      setDrag({ id, from, to: from, dy: 0, h: rects[from]!.height });
    },
    onPointerMove(e: React.PointerEvent) {
      const t = st.current;
      if (t.pid !== e.pointerId) return;
      const n = ids.length;
      // Clamp to the card: the row can go to the very top or bottom, not out.
      const lo = t.tops[0] - t.tops[t.from];
      const hi = (t.tops[n - 1] + t.hs[n - 1]) - (t.tops[t.from] + t.hs[t.from]);
      const dy = Math.max(lo, Math.min(hi, e.clientY - t.sy));
      // Its new place is however many OTHER rows' midpoints now sit above its
      // own centre — measured against the original layout, which is what
      // keeps the answer stable while the others are still moving.
      const c = t.tops[t.from] + t.hs[t.from] / 2 + dy;
      let to = 0;
      for (let j = 0; j < n; j++) if (j !== t.from && t.tops[j] + t.hs[j] / 2 < c) to++;
      if (to !== t.to) { t.to = to; haptic('tap'); }
      setDrag({ id, from: t.from, to, dy, h: t.hs[t.from] });
    },
    onPointerUp(e: React.PointerEvent) {
      const t = st.current;
      if (t.pid !== e.pointerId) return;
      t.pid = -1;
      setDrag(null);
      if (t.from !== t.to) {
        const next = [...ids];
        next.splice(t.to, 0, next.splice(t.from, 1)[0]);
        haptic('success');
        onCommit(next);
      }
    },
    onPointerCancel() { st.current.pid = -1; setDrag(null); },
    style: { touchAction: 'none', cursor: 'grab' } as React.CSSProperties,
  });

  const shift = (id: string): React.CSSProperties => {
    const ease = 'transform .18s cubic-bezier(.2,.8,.2,1)';
    if (!drag) return { transition: ease };
    const i = ids.indexOf(id);
    if (id === drag.id) {
      return {
        transform: `translateY(${drag.dy}px) scale(1.015)`, position: 'relative', zIndex: 2,
        filter: 'drop-shadow(0 6px 14px rgba(35,61,77,.22))',
      };
    }
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-drag.h}px)`, transition: ease };
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return { transform: `translateY(${drag.h}px)`, transition: ease };
    return { transition: ease };
  };

  return { drag, bind, grip, shift };
}

export default function CategoryEditor({ categories, canEdit }: {
  categories: Cat[]; canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [snack, setSnack] = useState<SnackState>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [order, setOrder] = useState<string[] | null>(null);   // set by a drag, until the server agrees
  const [, start] = useTransition();
  const closeSnack = useCallback(() => setSnack(null), []);

  const fromServer = categories.filter((c) => !c.archived && !hidden.has(c.id));
  const tops = fromServer.filter((c) => !c.parent_id);
  const live = order
    ? [...tops].sort((a, b) => rank(order, a.id) - rank(order, b.id))
    : tops;
  const kidsOf = (id: string) => fromServer.filter((c) => c.parent_id === id);
  const retired = categories.filter((c) => c.archived);
  const ids = live.map((c) => c.id);
  const parents: Parent[] = live.map((c) => ({ id: c.id, name: c.name, scope: c.scope }));
  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;

  const reorder = useReorder(ids, (next) => {
    setOrder(next);
    start(async () => {
      const r = await reorderCategories(next);
      if (!r.ok) { setOrder(null); setSnack({ text: r.error, tone: 'error' }); }
    });
  });

  function retire(c: Cat) {
    // The children go with a parent, on screen as on the server.
    const family = [c.id, ...kidsOf(c.id).map((k) => k.id)];
    const show = (h: Set<string>) => { const n = new Set(h); for (const id of family) n.delete(id); return n; };
    setHidden((h) => { const n = new Set(h); for (const id of family) n.add(id); return n; });
    start(async () => {
      const fd = new FormData(); fd.set('id', c.id);
      const r = await retireCategory(null, fd);
      if (!r.ok) {
        setHidden(show);
        setSnack({ text: r.error, tone: 'error' });
        return;
      }
      setSnack({
        text: r.message ?? `${c.name} retired.`,
        undo: () => start(async () => {
          const back = new FormData(); back.set('id', c.id);
          await restoreCategory(null, back);
          setHidden(show);
        }),
      });
    });
  }

  const rows = (c: Cat, siblings: Cat[], i: number, last: boolean) => (
    editing === c.id
      ? <EditRow key={c.id} cat={c} first={i === 0} last={i === siblings.length - 1}
          parents={parents.filter((p) => p.id !== c.id)} onDone={() => setEditing(null)} />
      : (
        <SwipeRow key={c.id} grip={!!c.parent_id} actions={canEdit ? [
          { label: 'Edit', tone: 'primary', icon: <Pen />, act: () => setEditing(c.id) },
          { label: 'Retire', tone: 'danger', icon: <Box />, act: () => retire(c) },
        ] : []}>
          <Row cat={c} last={last} canEdit={canEdit}
            lifted={reorder.drag?.id === c.id}
            onEdit={() => setEditing(c.id)} grip={c.parent_id ? null : reorder.grip(c.id)} />
        </SwipeRow>
      )
  );

  return (
    <>
      <Head>In use</Head>
      <section className="el card" style={{ ...card, overflow: 'hidden' }}>
        {live.map((c, i) => {
          const kids = kidsOf(c.id);
          const lastFamily = i === live.length - 1;
          return (
            <div key={c.id} ref={reorder.bind(c.id)} style={{ background: 'var(--c-card)', ...reorder.shift(c.id) }}>
              {rows(c, live, i, lastFamily && kids.length === 0)}
              {kids.map((k, j) => rows(k, kids, j, lastFamily && j === kids.length - 1))}
            </div>
          );
        })}
      </section>
      {canEdit && (
        <p style={{ margin: '-12px var(--gutter) 22px', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Tap a row to edit it, swipe it left to retire it, and drag by the grip to change the order.
          A category can sit under another — Milk under Groceries — and counts towards its line.
        </p>
      )}

      {canEdit && (adding
        ? <AddRow parents={parents} onDone={() => setAdding(false)} />
        : (
          <button type="button" onClick={() => setAdding(true)} className="el press" style={{
            margin: '0 var(--gutter) 22px', width: 'calc(100% - 36px)', minHeight: 56, borderRadius: 16,
            display: 'flex', alignItems: 'center', gap: 11, padding: '0 var(--pad)',
            background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
            color: 'var(--c-ink)', fontSize: 'var(--step-0)', fontWeight: 600,
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

      <Suggested have={categories.map((c) => c.name)} canEdit={canEdit}
        onResult={(r) => {
          haptic(r.ok ? 'success' : 'warn');
          setSnack(r.ok ? { text: r.message ?? 'Added.' } : { text: r.error, tone: 'error' });
        }} />

      {retired.length > 0 && (
        <>
          <Head>Retired</Head>
          <p style={{ margin: '-4px var(--gutter) 12px', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
            Not offered for new entries. Everything already filed under them is untouched, and
            they still appear in the months they were used.
          </p>
          <section className="el card" style={card}>
            {retired.map((c, i) => (
              <RetiredRow key={c.id} cat={c} under={nameOf(c.parent_id)} last={i === retired.length - 1} canEdit={canEdit}
                onBack={() => setHidden((h) => {
                  const n = new Set(h); n.delete(c.id);
                  for (const k of categories) if (k.parent_id === c.id) n.delete(k.id);
                  return n;
                })} />
            ))}
          </section>
        </>
      )}

      <Snack snack={snack} onClose={closeSnack} />
    </>
  );
}

const rank = (order: string[], id: string) => {
  const i = order.indexOf(id);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
};

function Row({ cat, last, canEdit, lifted, onEdit, grip }: {
  cat: Cat; last: boolean; canEdit: boolean; lifted: boolean; onEdit: () => void;
  grip: ReturnType<ReturnType<typeof useReorder>['grip']> | null;
}) {
  // A child is drawn a step in, with a short branch, and a little smaller —
  // it belongs to the row above, and the eye should read it that way before
  // reading the name.
  const child = !!cat.parent_id;
  const h = child ? 60 : 72;
  const body = (
    <>
      {child && (
        <span aria-hidden style={{
          width: 14, height: 22, flex: 'none', marginLeft: 12,
          borderLeft: '1.5px solid var(--c-border)', borderBottom: '1.5px solid var(--c-border)',
          borderBottomLeftRadius: 8, marginBottom: 14,
        }} />
      )}
      <Chip icon={cat.icon} tint={cat.tint} size={child ? 32 : 40} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: child ? 'var(--step--1)' : 'var(--step-0)', fontWeight: 600 }}>{cat.name}</span>
        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
          {cat.entries === 0 ? 'nothing filed here yet'
            : `${cat.entries} ${cat.entries === 1 ? 'entry' : 'entries'}`}
          {cat.budgeted_months > 0 && ` · budgeted in ${cat.budgeted_months} ${cat.budgeted_months === 1 ? 'month' : 'months'}`}
          {!child && cat.children > 0 && ` · ${cat.children} under it`}
          {!child && cat.scope !== 'expense' && ` · ${cat.scope === 'both' ? 'spending and income' : 'income'}`}
        </span>
      </span>
    </>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', minHeight: h,
      borderBottom: last || lifted ? undefined : '1px solid var(--c-rule)',
    }}>
      {canEdit ? (
        <button type="button" onClick={onEdit} style={{
          flex: 1, minWidth: 0, minHeight: h, display: 'flex', alignItems: 'center', gap: 12,
        }}>{body}</button>
      ) : (
        <span style={{ flex: 1, minWidth: 0, minHeight: h, display: 'flex', alignItems: 'center', gap: 12 }}>
          {body}
        </span>
      )}
      {canEdit && grip && (
        <span aria-hidden {...grip} style={{
          ...grip.style, width: 44, minHeight: 72, marginRight: -8, flex: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: lifted ? 'var(--c-teal)' : 'var(--c-off)',
        }}>
          <svg width={16} height={20} viewBox="0 0 16 20" fill="currentColor" aria-hidden>
            <circle cx="5" cy="4" r="1.7" /><circle cx="11" cy="4" r="1.7" />
            <circle cx="5" cy="10" r="1.7" /><circle cx="11" cy="10" r="1.7" />
            <circle cx="5" cy="16" r="1.7" /><circle cx="11" cy="16" r="1.7" />
          </svg>
        </span>
      )}
    </div>
  );
}

function EditRow({ cat, first, last, parents, onDone }: {
  cat: Cat; first: boolean; last: boolean; parents: Parent[]; onDone: () => void;
}) {
  const [state, act, pending] = useActionState(editCategory, null);
  const [retireState, retire, retiring] = useActionState(retireCategory, null);
  const [, move] = useActionState(moveCategory, null);
  const [icon, setIcon] = useState(cat.icon);
  const [tint, setTint] = useState(cat.tint);
  const [scope, setScope] = useState<Scope>(cat.scope);
  const [parentId, setParentId] = useState(cat.parent_id ?? '');
  const parent = parents.find((p) => p.id === parentId) ?? null;

  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <input type="hidden" name="id" value={cat.id} />
        <NameField defaultValue={cat.name} />
        <UnderField parents={parents} value={parentId} onChange={setParentId} locked={cat.children > 0} />
        <ScopeField value={scope} onChange={setScope} parent={parent} />
        <Picker icon={icon} tint={tint} onIcon={setIcon} onTint={setTint} />
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" onClick={onDone} style={ghost}>Cancel</button>
          <button type="submit" disabled={pending} style={solid}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {/* The same moves the grip makes, for a keyboard or a screen reader. */}
      <div style={{ display: 'flex', gap: 9 }}>
        {[['up', !first, 'Move up'], ['down', !last, 'Move down']].map(([dir, enabled, label]) => (
          <form key={dir as string} action={move} style={{ flex: 1, display: 'flex' }}>
            <input type="hidden" name="id" value={cat.id} />
            <input type="hidden" name="direction" value={dir as string} />
            <button type="submit" disabled={!enabled} style={{
              ...ghost, flex: 1, minHeight: 44, justifyContent: 'center', display: 'flex',
              alignItems: 'center', gap: 6, opacity: enabled ? 1 : .45,
            }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
              </svg>
              {label as string}
            </button>
          </form>
        ))}
      </div>

      <form action={retire} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input type="hidden" name="id" value={cat.id} />
        <button className="cta" type="submit" disabled={retiring} style={{
          minHeight: 44, borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
          background: 'transparent', color: 'var(--c-danger)',
        }}>{retiring ? 'Retiring…' : 'Retire this category'}</button>
        {retireState && !retireState.ok && (
          <span role="alert" style={{ fontSize: 'var(--step--1)', color: 'var(--c-danger)' }}>
            {retireState.error}
          </span>
        )}
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          It stops being offered for new entries{cat.children > 0 && ', and so do the ones under it'}.
          Nothing already filed under it moves, and no month changes value.
        </span>
      </form>
    </div>
  );
}

function AddRow({ parents, onDone }: { parents: Parent[]; onDone: () => void }) {
  const [state, act, pending] = useActionState(addCategory, null);
  const [icon, setIcon] = useState<string>('tag');
  const [tint, setTint] = useState<string>('blue');
  const [scope, setScope] = useState<Scope>('expense');
  const [parentId, setParentId] = useState('');
  const parent = parents.find((p) => p.id === parentId) ?? null;

  return (
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <NameField />
      <UnderField parents={parents} value={parentId} onChange={setParentId} />
      <ScopeField value={scope} onChange={setScope} parent={parent} />
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

function RetiredRow({ cat, under, last, canEdit, onBack }: {
  cat: Cat; under: string | null; last: boolean; canEdit: boolean; onBack: () => void;
}) {
  const [, restore] = useActionState(restoreCategory, null);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 68, opacity: 0.7,
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <Chip icon={cat.icon} tint={cat.tint} size={36} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{cat.name}</span>
        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
          {cat.entries} {cat.entries === 1 ? 'entry' : 'entries'} kept{under && ` · under ${under}`}
        </span>
      </span>
      {canEdit && (
        <form action={restore} onSubmit={() => { haptic('select'); onBack(); }}>
          <input type="hidden" name="id" value={cat.id} />
          <button className="cta" type="submit" style={{
            minHeight: 44, padding: '0 12px', borderRadius: 11, fontSize: 'var(--step--1)',
            fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-ink)',
          }}>Bring back</button>
        </form>
      )}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--gutter) 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function Pen() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M13.5 6.5l3 3" />
    </svg>
  );
}
function Box() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M3 5h18v3H3z" /><path d="M10 12h4" />
    </svg>
  );
}

const card: React.CSSProperties = {
  margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
};
const ghost: React.CSSProperties = {
  minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
  background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const solid: React.CSSProperties = {
  flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
  textAlign: 'center', background: 'var(--g-primary)', color: 'var(--c-on-primary)',
};
