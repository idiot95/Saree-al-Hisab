'use client';

import { useRef, useState } from 'react';
import Sheet from '../Sheet';
import { Chip } from '../Icon';
import { haptic } from '../haptics';
import type { Category } from './AddEntry';

/* The drawer behind the magnifier on Add Entry: every category, grouped
   under its parent, with a search box that narrows the list as you type.
   The filter runs over the rows already on the phone, so it works offline
   and needs no server; a word matches a category, its parent, or any of
   its children — "groc" shows Groceries with Milk and Vegetables under it,
   and "milk" shows Groceries with just Milk. */
export default function CategoryFinder({ open, onClose, categories, selected, onPick }: {
  open: boolean; onClose: () => void; categories: Category[];
  selected: string | null; onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const box = useRef<HTMLInputElement>(null);
  const needle = q.trim().toLowerCase();
  const hit = (c: Category) => !needle || c.name.toLowerCase().includes(needle);

  const tops = categories.filter((c) => !c.parent_id);
  const families = tops.map((p) => {
    const kids = categories.filter((c) => c.parent_id === p.id);
    const own = hit(p);
    const shownKids = own ? kids : kids.filter(hit);
    return { p, kids: shownKids, show: own || shownKids.length > 0 };
  }).filter((f) => f.show);

  const row = (c: Category, child: boolean) => {
    const on = c.id === selected;
    return (
      <button key={c.id} type="button" aria-pressed={on}
        onClick={() => { haptic('select'); onPick(c.id); }}
        style={{
          minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: child ? '0 0 0 34px' : 0, textAlign: 'left',
          borderBottom: '1px solid var(--c-rule)',
          background: on ? 'var(--c-sunk)' : 'transparent', color: 'var(--c-ink)',
        }}>
        <Chip icon={c.icon} tint={c.tint} size={child ? 30 : 36} />
        <span style={{ flex: 1, minWidth: 0, fontSize: child ? 'var(--step--1)' : 'var(--step-0)', fontWeight: 600 }}>
          {c.name}
        </span>
        {on && (
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l5 5 9-11" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} label="Find a category" focus={box}>
      <input ref={box} type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Find a category" aria-label="Find a category" autoComplete="off"
        enterKeyHint="search"
        style={{
          width: '100%', minHeight: 50, borderRadius: 13, padding: '0 14px', marginBottom: 6,
          border: '1px solid var(--c-border)', background: 'var(--c-sunk2)',
          color: 'var(--c-ink)', fontSize: 'var(--field)',
        }} />
      {families.length === 0 && (
        <p style={{ margin: '14px 0', fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          Nothing called that. Categories are set up under Settings.
        </p>
      )}
      {families.map((f) => (
        <div key={f.p.id}>
          {row(f.p, false)}
          {f.kids.map((k) => row(k, true))}
        </div>
      ))}
    </Sheet>
  );
}
