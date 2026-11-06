'use client';

import { useActionState, useCallback, useId, useRef, useState, useTransition } from 'react';
import { Icon, Chip, tintOf } from '../Icon';
import { ErrorNote, Field } from '../auth-ui';
import { fieldLabel, formCard, ghost, selectCls, solid, AddRow as AddButton, Said } from '../form-bits';
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
import { keepFields, useFocusSoon, useOnSuccess } from '../worth/fields';

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
   glyphs is far past what Hick's law would want in one glance, so one row is
   offered, with a search box above it (type "mil" and the row is milk) and the
   rest behind "Show all". The names are the search index, so it works offline and costs
   nothing. */
function Picker({ icon, tint, onIcon, onTint }: {
  icon: string; tint: string; onIcon: (v: string) => void; onTint: (v: string) => void;
}) {
  const [find, setFind] = useState('');
  const q = find.trim().toLowerCase();
  const matches: readonly string[] = q ? ICONS.filter((n) => n.includes(q)) : ICONS;
  /* 184 icons are far past one glance, and a grid of them all put Save some 2,000px down the form. So ONE list in a
     fixed order — the first five always on show, the rest behind "Show all" in a short box that scrolls by itself —
     and the search to narrow it. Choosing an icon never moves it: its button stays where it is (and keeps focus).
     The split is over the matches only, so for a given search it never depends on which icon is chosen. The chosen
     icon stays in sight: when a search does not match it, it has a slot of its own before the row (choosing a match
     then only takes that slot away, and no match moves); when it sits in the shut box it is shown again as a sixth
     tile ahead of "Show all". */
  const head = matches.slice(0, 5);
  const rest = matches.slice(5);
  const chosenOutside = !!q && !matches.includes(icon);
  const [all, setAll] = useState(false);
  const allId = useId();
  const chosenHidden = !all && rest.includes(icon);
  const [ibg, iink] = tintOf(tint);
  const tile = (n: string) => {
    const on = n === icon;
    return (
      <button key={n} type="button" onClick={() => { haptic('tap'); onIcon(n); }}
        aria-label={n} aria-pressed={on}
        className={`flex min-h-12 items-center justify-center rounded-xl border ${on ? '' : 'border-border bg-background text-muted-foreground'}`}
        style={on ? { background: ibg, color: iink, borderColor: iink } : undefined}>
        <Icon name={n} size={20} />
      </button>
    );
  };
  return (
    <>
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="tint" value={tint} />

      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 ${fieldLabel}`}>Colour</legend>
        <div className="flex flex-wrap gap-2">
          {TINTS.map((t) => {
            const [bg, ink] = tintOf(t);
            const on = t === tint;
            /* The swatch is the category's own tint (data, so a style); the chosen one carries a check and a ring. */
            return (
              <button key={t} type="button" onClick={() => { haptic('tap'); onTint(t); }}
                aria-label={t} aria-pressed={on}
                className="grid size-11 place-items-center rounded-full border-2 in-data-[platform=android]:size-12"
                style={{ background: bg, color: ink, borderColor: on ? ink : 'transparent' }}>
                {on && <Icon name="check" size={18} />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 ${fieldLabel}`}>Icon</legend>
        <input type="search" value={find} onChange={(e) => setFind(e.target.value)}
          placeholder="Find an icon" aria-label="Find an icon" autoComplete="off"
          className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[length:var(--field)] text-foreground" />
        {matches.length === 0 && (
          <span className="py-2 text-sm text-muted-foreground">Nothing called that. Try another word.</span>
        )}
        {chosenOutside && (
          <div className="flex items-center gap-3">
            <div className="grid w-[calc((100%_-_2rem)/5)] flex-none">{tile(icon)}</div>
            <span className="text-sm text-muted-foreground">Chosen now</span>
          </div>
        )}
        <div className="grid grid-cols-5 gap-2">{head.map(tile)}</div>
        {(chosenHidden || rest.length > 0) && (
          <div className="flex items-center gap-3">
            {chosenHidden && <div className="grid w-[calc((100%_-_2rem)/5)] flex-none">{tile(icon)}</div>}
            {rest.length > 0 && (
              <button type="button" aria-expanded={all} aria-controls={allId} onClick={() => setAll((o) => !o)}
                className="press flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary in-data-[platform=android]:min-h-12">
                <Icon name={all ? 'expand_less' : 'expand_more'} size={18} />
                {all ? 'Fewer icons' : q ? `Show all ${matches.length} matches` : `Show all ${matches.length} icons`}
              </button>
            )}
          </div>
        )}
        {/* The rest of the same list, four rows tall, so the form's Save stays a short scroll away. */}
        {all && rest.length > 0 && (
          <div id={allId} role="group" aria-label="All icons"
            className="grid max-h-[232px] grid-cols-5 gap-2 overflow-y-auto overscroll-contain rounded-xl border border-border p-2">
            {rest.map(tile)}
          </div>
        )}
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
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>Under</span>
      {locked ? (
        <span className="py-1 text-sm leading-snug text-muted-foreground">
          It has categories under it, so it stays at the top level.
        </span>
      ) : (
        <select name="parentId" value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
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
    <div role="group" aria-label="Files" className="flex flex-col gap-1.5">
      <span className={fieldLabel}>Files</span>
      {parent ? (
        <span className="py-1 text-sm leading-snug text-muted-foreground">
          {SCOPE_LABEL[parent.scope].toLowerCase()}, the same as {parent.name}.
        </span>
      ) : (
        <Segmented name="scope" value={value} options={SCOPES} onChange={onChange} label="Spending, income, or both" />
      )}
    </div>
  );
}

function NameField({ defaultValue }: { defaultValue?: string }) {
  return <Field label="Name" name="name" defaultValue={defaultValue} required maxLength={40} placeholder="Groceries" />;
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
        filter: 'drop-shadow(0 6px 14px color-mix(in srgb, var(--foreground) 22%, transparent))',
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
  /* The add form closed (a save or Cancel): focus back on "Add a category", and a save said in the live region —
     "Groceries added." — since the row it made arrives in the list far above, out of sight of the form. */
  const [added, setAdded] = useState('');
  const [addOpener, focusAddOpener] = useFocusSoon<HTMLButtonElement>();
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
  /* A child takes its parent's scope (0108 enforces it), so offering an
     income category a spending parent offers to change what it is for —
     silently when nothing is filed under it, and as a constraint error when
     something is. Only headings of the same kind are on the list. */
  const takes = (p: Parent, scope: Scope) => p.scope === scope || p.scope === 'both' || scope === 'both';
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
          parents={parents.filter((p) => p.id !== c.id && takes(p, c.scope))} onDone={() => setEditing(null)} />
      : (
        <SwipeRow key={c.id} grip={!!c.parent_id} actions={canEdit ? [
          { label: 'Edit', tone: 'primary', icon: <Icon name="pencil" size={20} />, act: () => setEditing(c.id) },
          { label: 'Retire', tone: 'danger', icon: <Icon name="archive" size={20} />, act: () => retire(c) },
        ] : []}>
          <Row cat={c} last={last} canEdit={canEdit}
            lifted={reorder.drag?.id === c.id}
            onEdit={() => setEditing(c.id)} grip={c.parent_id ? null : reorder.grip(c.id)} />
        </SwipeRow>
      )
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="sec-in-use" className="flex flex-col gap-1.5 px-[var(--gutter)]">
        <h2 id="sec-in-use" className="px-0.5 text-[13px] font-semibold text-muted-foreground">In use</h2>
        {/* px-[var(--pad)]: a swipe row's negative margin is --pad, so its actions stop at the rounded edge. */}
        <div className="overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
          {live.map((c, i) => {
            const kids = kidsOf(c.id);
            const lastFamily = i === live.length - 1;
            return (
              <div key={c.id} ref={reorder.bind(c.id)} className="bg-card" style={reorder.shift(c.id)}>
                {rows(c, live, i, lastFamily && kids.length === 0)}
                {kids.map((k, j) => rows(k, kids, j, lastFamily && j === kids.length - 1))}
              </div>
            );
          })}
        </div>
        {canEdit && (
          <p className="px-0.5 pt-0.5 text-[13px] leading-snug text-muted-foreground">
            Tap a row to edit it, swipe it left to retire it, and drag by the grip to change the order.
            A category can sit under another — Milk under Groceries — and counts towards its line.
          </p>
        )}
      </section>

      {canEdit && (
        <div className="px-[var(--gutter)]">
          <Said>{added}</Said>
          {adding
            ? <AddRow parents={parents} takes={takes} onDone={(message) => { setAdding(false); setAdded(message ?? ''); focusAddOpener(); }} />
            : <AddButton ref={addOpener} onClick={() => { setAdded(''); setAdding(true); }}
                done={added ? <span className="flex items-center gap-1 text-sm font-semibold text-primary"><Icon name="check" size={16} />Added</span> : null}>
                Add a category
              </AddButton>}
        </div>
      )}

      <Suggested have={categories.map((c) => c.name)} canEdit={canEdit}
        onResult={(r) => {
          haptic(r.ok ? 'success' : 'warn');
          setSnack(r.ok ? { text: r.message ?? 'Added.' } : { text: r.error, tone: 'error' });
        }} />

      {retired.length > 0 && (
        <section aria-labelledby="sec-retired" className="flex flex-col gap-1.5 px-[var(--gutter)]">
          <h2 id="sec-retired" className="px-0.5 text-[13px] font-semibold text-muted-foreground">Retired</h2>
          <p className="px-0.5 pb-0.5 text-[13px] leading-snug text-muted-foreground">
            Not offered for new entries. Everything already filed under them is untouched, and
            they still appear in the months they were used.
          </p>
          <div className="overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
            {retired.map((c, i) => (
              <RetiredRow key={c.id} cat={c} under={nameOf(c.parent_id)} last={i === retired.length - 1} canEdit={canEdit}
                onBack={() => setHidden((h) => {
                  const n = new Set(h); n.delete(c.id);
                  for (const k of categories) if (k.parent_id === c.id) n.delete(k.id);
                  return n;
                })} />
            ))}
          </div>
        </section>
      )}

      <Snack snack={snack} onClose={closeSnack} />
    </div>
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
  const h = child ? 'min-h-[60px]' : 'min-h-[72px]';
  const body = (
    <>
      {child && (
        <span aria-hidden className="mb-3.5 ml-3 h-[22px] w-3.5 flex-none rounded-bl-lg border-b-[1.5px] border-l-[1.5px] border-border" />
      )}
      <Chip icon={cat.icon} tint={cat.tint} size={child ? 32 : 38} radius={999} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
        <span className={`${child ? 'text-sm' : 'text-[15px]'} font-semibold leading-snug [overflow-wrap:anywhere]`}>{cat.name}</span>
        <span className="text-[13px] leading-snug text-muted-foreground">
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
    <div className={`flex items-center ${h} ${last || lifted ? '' : 'border-b border-border'}`}>
      {canEdit ? (
        <button type="button" onClick={onEdit} aria-label={`Edit ${cat.name}`}
          className={`flex min-w-0 flex-1 items-center gap-3 text-left text-foreground ${h}`}>{body}</button>
      ) : (
        <span className={`flex min-w-0 flex-1 items-center gap-3 ${h}`}>{body}</span>
      )}
      {canEdit && grip && (
        <span aria-hidden {...grip}
          className={`-mr-2 flex min-h-[72px] w-11 flex-none items-center justify-center ${lifted ? 'text-primary' : 'text-muted-foreground'}`}>
          <Icon name="drag_indicator" size={22} />
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
    <div className="flex flex-col gap-3.5 border-b border-border py-4 last:border-b-0">
      {/* JS-only (opened by a tap): keepFields, so a refusal never resets Under or the scope back. */}
      <form onSubmit={keepFields(act)} aria-label={`Edit ${cat.name}`} className="flex flex-col gap-3.5">
        <input type="hidden" name="id" value={cat.id} />
        <NameField defaultValue={cat.name} />
        <UnderField parents={parents} value={parentId} onChange={setParentId} locked={cat.children > 0} />
        <ScopeField value={scope} onChange={setScope} parent={parent} />
        <Picker icon={icon} tint={tint} onIcon={setIcon} onTint={setTint} />
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className={ghost}>Cancel</button>
          <button type="submit" disabled={pending} className={solid}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {/* The same moves the grip makes, for a keyboard or a screen reader. */}
      <div className="flex gap-2">
        {([['up', !first, 'Move up'], ['down', !last, 'Move down']] as const).map(([dir, enabled, label]) => (
          <form key={dir} action={move} className="flex flex-1">
            <input type="hidden" name="id" value={cat.id} />
            <input type="hidden" name="direction" value={dir} />
            <button type="submit" disabled={!enabled} className={`${ghost} min-h-11 flex-1 disabled:opacity-45`}>
              <Icon name={dir === 'up' ? 'arrow_upward' : 'arrow_downward'} size={18} />
              {label}
            </button>
          </form>
        ))}
      </div>

      <form action={retire} className="flex flex-col gap-1.5">
        <input type="hidden" name="id" value={cat.id} />
        <button type="submit" disabled={retiring}
          className="press flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-destructive disabled:opacity-60">
          <Icon name="archive" size={18} />{retiring ? 'Retiring…' : 'Retire this category'}
        </button>
        {retireState && !retireState.ok && <ErrorNote>{retireState.error}</ErrorNote>}
        <span className="text-xs leading-snug text-muted-foreground">
          It stops being offered for new entries{cat.children > 0 && ', and so do the ones under it'}.
          Nothing already filed under it moves, and no month changes value.
        </span>
      </form>
    </div>
  );
}

function AddRow({ parents, takes, onDone }: {
  parents: Parent[]; takes: (p: Parent, scope: Scope) => boolean; onDone: (message?: string) => void;
}) {
  const [state, act, pending] = useActionState(addCategory, null);
  // Added: close, so the next one starts from the defaults rather than this one's name, colour and icon.
  useOnSuccess(state, () => onDone(state?.ok ? state.message : undefined));
  const [icon, setIcon] = useState<string>('tag');
  const [tint, setTint] = useState<string>('blue');
  const [scope, setScope] = useState<Scope>('expense');
  const [parentId, setParentId] = useState('');
  const parent = parents.find((p) => p.id === parentId) ?? null;

  return (
    /* JS-only (opened by a tap): keepFields, so a refusal never resets Under or the scope back. */
    <form onSubmit={keepFields(act)} aria-label="Add a category" className={formCard}>
      <NameField />
      <UnderField parents={parents.filter((p) => takes(p, scope))} value={parentId} onChange={setParentId} />
      {/* Changing the kind can strand a parent that no longer takes it, so the
          pair is broken rather than left disagreeing with itself. */}
      <ScopeField value={scope} onChange={(v) => {
        setScope(v);
        if (parent && !takes(parent, v)) setParentId('');
      }} parent={parent} />
      <Picker icon={icon} tint={tint} onIcon={setIcon} onTint={setTint} />
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex gap-2">
        <button type="button" onClick={() => onDone()} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending} className={solid}>
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
    <div className={`flex min-h-[68px] items-center gap-3 py-2.5 ${last ? '' : 'border-b border-border'}`}>
      <span className="opacity-70"><Chip icon={cat.icon} tint={cat.tint} size={36} radius={999} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold leading-snug text-muted-foreground [overflow-wrap:anywhere]">{cat.name}</span>
        <span className="text-[13px] leading-snug text-muted-foreground">
          {cat.entries} {cat.entries === 1 ? 'entry' : 'entries'} kept{under && ` · under ${under}`}
        </span>
      </span>
      {canEdit && (
        <form action={restore} onSubmit={() => { haptic('select'); onBack(); }}>
          <input type="hidden" name="id" value={cat.id} />
          <button type="submit" aria-label={`Bring back ${cat.name}`}
            className="press flex min-h-11 items-center gap-1.5 rounded-xl bg-muted px-3 text-sm font-semibold text-foreground">
            <Icon name="restore" size={18} />Bring back
          </button>
        </form>
      )}
    </div>
  );
}
