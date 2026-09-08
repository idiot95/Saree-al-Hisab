'use client';

import { useState } from 'react';
import { Chip } from './Icon';
import { haptic } from './haptics';
import CategoryFinder, { type Category } from './CategoryFinder';

/* A category field for the smaller forms — a schedule, an edit, a write-off.
   One tall row shows the pick with its icon; tapping it opens the same
   searchable drawer as Add Entry, with children under their parent. Hand
   it only the categories that fit the entry (see fits() in lib/scope).
   With a `name` it carries the id in a hidden input for a form action;
   controlled callers pass `value` and `onChange` instead. */
export default function CategoryPick({
  categories, value, defaultValue, onChange, name, label = 'Category', disabled,
  placeholder = 'Choose a category',
}: {
  categories: Category[]; value?: string | null; defaultValue?: string | null;
  onChange?: (id: string) => void; name?: string; label?: string; disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState<string | null>(defaultValue ?? null);
  const cur = value !== undefined ? value : own;
  const chosen = categories.find((c) => c.id === cur) ?? null;
  const pick = (id: string) => { setOwn(id); onChange?.(id); setOpen(false); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>{label}</span>
      {name && <input type="hidden" name={name} value={chosen?.id ?? ''} />}
      <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { haptic('tap'); setOpen(true); }}
        style={{
          minHeight: 58, display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '8px 12px', borderRadius: 14, border: '1px solid var(--c-border)',
          background: 'var(--c-sunk2)', color: 'var(--c-ink)', opacity: disabled ? 0.6 : 1,
        }}>
        {chosen ? (
          <Chip icon={chosen.icon} tint={chosen.tint} size={38} />
        ) : (
          <span aria-hidden style={{
            width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--c-teal)',
            border: '1px dashed var(--c-dash)',
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.2} strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.5-4.5" />
            </svg>
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontWeight: 600, fontSize: 'var(--step-0)', overflowWrap: 'anywhere',
            color: chosen ? 'var(--c-ink)' : 'var(--c-meta)',
          }}>
            {chosen ? chosen.name : placeholder}
          </span>
          {chosen?.parent && (
            <span style={{ display: 'block', fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              under {chosen.parent}
            </span>
          )}
        </span>
        <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-teal)', flex: 'none' }}>
          {chosen ? 'Change' : 'Find'}
        </span>
      </button>
      <CategoryFinder open={open} onClose={() => setOpen(false)} categories={categories}
        selected={chosen?.id ?? null} onPick={pick} />
    </div>
  );
}
