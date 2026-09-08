'use client';

import { useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { CHIP, CHIP_TEXT } from '../PayPicker';
import { OFF, on } from '../choice';
import type { Category } from '../CategoryFinder';

/* The second page of Add Entry: what the money was for.

   Every top-level category is a tile, and every tile is grey until it is
   the answer — then it wears its own colour, and if it has children they
   appear beneath it as a row of chips, grey the same way. Choosing a child
   colours the child in full and leaves its parent in a light wash, so the
   pair reads as "Groceries, and within it Milk". Tapping the coloured thing
   again lets go of it: a child back to its parent, a parent back to nothing.

   A search box narrows the whole family tree as you type, for a household
   with more categories than fit above the fold. The filter runs over rows
   already on the phone, so it works offline. */
export default function CategoryGrid({ categories, value, onChange, label }: {
  categories: Category[]; value: string | null; onChange: (id: string | null) => void;
  label: string;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const tops = categories.filter((c) => !c.parent_id);
  const chosen = categories.find((c) => c.id === value) ?? null;
  const familyId = chosen ? chosen.parent_id ?? chosen.id : null;
  const family = tops.find((t) => t.id === familyId) ?? null;
  const kids = familyId ? categories.filter((c) => c.parent_id === familyId) : [];
  const pick = (id: string | null) => { haptic('select'); onChange(id); };

  if (categories.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
        No categories take this kind of entry yet — set them up under Categories.
      </p>
    );
  }

  const hits = needle
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(needle) || (c.parent ?? '').toLowerCase().includes(needle))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Find a category" aria-label={label} autoComplete="off" enterKeyHint="search"
        style={{
          width: '100%', minHeight: 48, borderRadius: 13, padding: '0 14px',
          border: '1px solid var(--c-border)', background: 'var(--c-card)',
          color: 'var(--c-ink)', fontSize: 'var(--field)',
        }} />

      {needle ? (
        <div role="group" aria-label="Matching categories" style={{
          display: 'flex', flexDirection: 'column', borderRadius: 14,
          background: 'var(--c-card)', border: '1px solid var(--c-border)', overflow: 'hidden',
        }}>
          {hits.length === 0 && (
            <p style={{ margin: 0, padding: '14px', fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              Nothing called that.
            </p>
          )}
          {hits.map((c, i) => {
            const isOn = c.id === value;
            return (
              <button key={c.id} type="button" aria-pressed={isOn}
                onClick={() => { pick(c.id); setQ(''); }}
                style={{
                  minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px',
                  borderTop: i === 0 ? undefined : '1px solid var(--c-rule)',
                  background: isOn ? `var(--cat-${c.tint})` : 'transparent',
                  color: isOn ? `var(--cat-${c.tint}-ink)` : 'var(--c-ink)',
                }}>
                <Chip icon={c.icon} tint={isOn ? c.tint : 'neutral'} size={34} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600, ...CHIP_TEXT }}>
                  {c.parent ? <span style={{ color: 'var(--c-meta)', fontWeight: 500 }}>{c.parent} › </span> : null}
                  {c.name}
                </span>
                {isOn && <Icon name="check" size={18} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div role="group" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {tops.map((c) => {
              const leaf = c.id === value;
              const wash = !leaf && c.id === familyId;
              const ink = `var(--cat-${c.tint}-ink)`;
              return (
                <button key={c.id} type="button" aria-pressed={leaf || wash}
                  onClick={() => pick(leaf ? null : c.id)}
                  style={{
                    ...TILE,
                    ...(leaf ? on(ink) : wash
                      ? { background: `var(--cat-${c.tint})`, color: ink, border: `1px solid ${ink}` }
                      : OFF),
                  }}>
                  <Icon name={c.icon} size={22} strokeWidth={1.9} />
                  <span style={TILE_LABEL}>{c.name}</span>
                </button>
              );
            })}
          </div>

          {family && kids.length > 0 && (
            <div role="group" aria-label={`Within ${family.name}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {kids.map((k) => {
                const isOn = k.id === value;
                const ink = `var(--cat-${k.tint}-ink)`;
                return (
                  <button key={k.id} type="button" aria-pressed={isOn}
                    onClick={() => pick(isOn ? family.id : k.id)}
                    style={{ ...CHIP, ...(isOn ? on(ink) : OFF) }}>
                    <Icon name={k.icon} size={16} strokeWidth={1.9} />
                    <span style={CHIP_TEXT}>{k.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TILE: React.CSSProperties = {
  minHeight: 68, padding: '8px 6px', borderRadius: 14, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 5, textAlign: 'center',
  transition: 'background .15s, color .15s',
};
const TILE_LABEL: React.CSSProperties = {
  fontSize: 'var(--step--2)', fontWeight: 700, lineHeight: 1.15, maxWidth: '100%',
  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere',
};
