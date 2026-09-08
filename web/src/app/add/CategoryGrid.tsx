'use client';

import { useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { CHIP, CHIP_TEXT } from '../PayPicker';
import { OFF, on } from '../choice';
import { blurbFor } from '@/lib/taxonomy';
import type { Category } from '../CategoryFinder';

/* Category is a quick two-level decision. The compact grid contains only the
   parent headings; opening one reveals its subcategories immediately below.
   Search spans both levels and labels every child as a subcategory, so typing
   "milk" can select Milk & dairy directly without first finding Groceries. */
export default function CategoryGrid({ categories, value, onChange, label }: {
  categories: Category[]; value: string | null; onChange: (id: string | null) => void;
  label: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(() => {
    const selected = categories.find((c) => c.id === value);
    return selected ? selected.parent_id ?? selected.id : null;
  });
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const tops = categories.filter((c) => !c.parent_id);
  const pick = (id: string | null) => { haptic('select'); onChange(id); };

  if (categories.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
        No categories take this kind of entry yet — set them up under Categories.
      </p>
    );
  }

  const hits = needle ? categories.filter((c) => {
    const parent = c.parent?.toLowerCase() ?? '';
    return c.name.toLowerCase().includes(needle) || parent.includes(needle);
  }) : [];
  const favourites = categories
    .filter((c) => (c.uses ?? 0) > 0)
    .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
    .slice(0, 4);
  const openFamily = tops.find((c) => c.id === expanded) ?? null;
  const openKids = openFamily ? categories.filter((c) => c.parent_id === openFamily.id) : [];
  const selected = categories.find((c) => c.id === value);

  const chooseResult = (c: Category) => {
    pick(c.id);
    setExpanded(c.parent_id ?? c.id);
    setQ('');
  };

  return (
    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ position: 'relative', display: 'block' }}>
        <span aria-hidden style={{
          position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
          color: 'var(--c-meta)', pointerEvents: 'none',
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" />
          </svg>
        </span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search category or subcategory" aria-label={label} autoComplete="off"
          enterKeyHint="search" style={{
            width: '100%', minHeight: 50, borderRadius: 14, padding: '0 42px',
            border: `1px solid ${needle ? 'var(--c-primary-hi)' : 'var(--c-border)'}`,
            background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
          }} />
        {needle && (
          <button type="button" aria-label="Clear category search" onClick={() => setQ('')} style={{
            position: 'absolute', right: 4, top: 3, width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--c-meta)', fontSize: 20,
          }}>×</button>
        )}
      </label>

      {needle ? (
        <SearchResults hits={hits} value={value} onPick={chooseResult} />
      ) : (
        <>
          {favourites.length >= 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <SmallHead>Most used</SmallHead>
              <div role="group" aria-label="Most used categories"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {favourites.map((c) => {
                  const isOn = c.id === value;
                  const ink = `var(--cat-${c.tint}-ink)`;
                  return (
                    <button key={c.id} type="button" aria-pressed={isOn}
                      onClick={() => {
                        pick(isOn ? c.parent_id ?? null : c.id);
                        setExpanded(c.parent_id ?? c.id);
                      }} style={{ ...CHIP, ...(isOn ? on(ink) : OFF) }}>
                      <Icon name={c.icon} size={16} strokeWidth={1.9} />
                      <span style={CHIP_TEXT}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div role="group" aria-label={label} style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8,
          }}>
            {tops.map((c) => {
              const kids = categories.filter((k) => k.parent_id === c.id);
              const activeFamily = selected ? (selected.parent_id ?? selected.id) === c.id : false;
              const isOpen = expanded === c.id;
              const ink = `var(--cat-${c.tint}-ink)`;
              return (
                <button key={c.id} type="button" aria-pressed={c.id === value}
                  aria-expanded={kids.length ? isOpen : undefined}
                  onClick={() => {
                    pick(c.id === value ? null : c.id);
                    setExpanded(isOpen && c.id === value ? null : c.id);
                  }} style={{
                    minHeight: 68, padding: '10px 11px', borderRadius: 14,
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    ...(activeFamily
                      ? { background: `var(--cat-${c.tint})`, color: ink, border: `1px solid ${ink}` }
                      : OFF),
                  }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 11, flex: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: activeFamily ? 'rgba(255,255,255,.42)' : 'var(--c-sunk2)',
                  }}><Icon name={c.icon} size={19} strokeWidth={1.9} /></span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      fontSize: 'var(--step--1)', fontWeight: 700, lineHeight: 1.15,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.name}</span>
                    <span style={{ fontSize: 10, lineHeight: 1.1, opacity: .72 }}>
                      {kids.length ? `${kids.length} subcategories` : 'Category'}
                    </span>
                  </span>
                  {kids.length > 0 && (
                    <span aria-hidden style={{
                      display: 'flex', transform: isOpen ? 'rotate(180deg)' : undefined,
                      transition: 'transform .15s', opacity: .7,
                    }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {openFamily && openKids.length > 0 && (
            <section style={{
              borderRadius: 16, background: 'var(--c-card)', border: '1px solid var(--c-border)',
              padding: 10, display: 'flex', flexDirection: 'column', gap: 9,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 3px 0' }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 700,
                }}>Within {openFamily.name}</span>
                <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>Choose one</span>
              </div>
              <div role="group" aria-label={`Subcategories within ${openFamily.name}`} style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7,
              }}>
                {openKids.map((c) => {
                  const isOn = c.id === value;
                  const ink = `var(--cat-${c.tint}-ink)`;
                  return (
                    <button key={c.id} type="button" aria-pressed={isOn}
                      onClick={() => pick(isOn ? openFamily.id : c.id)} style={{
                        minHeight: 52, padding: '7px 9px', borderRadius: 12,
                        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                        ...(isOn ? on(ink) : OFF),
                      }}>
                      <Icon name={c.icon} size={18} strokeWidth={1.85} />
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 'var(--step--2)', fontWeight: 650,
                        lineHeight: 1.18, overflowWrap: 'anywhere',
                      }}>{c.name}</span>
                      {isOn && <Icon name="check" size={15} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SearchResults({ hits, value, onPick }: {
  hits: Category[]; value: string | null; onPick: (c: Category) => void;
}) {
  return (
    <div role="group" aria-label="Matching categories and subcategories" style={{
      display: 'flex', flexDirection: 'column', borderRadius: 14,
      background: 'var(--c-card)', border: '1px solid var(--c-border)', overflow: 'hidden',
    }}>
      {hits.length === 0 && (
        <p style={{ margin: 0, padding: 14, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          No category or subcategory matches that.
        </p>
      )}
      {hits.map((c, i) => {
        const isOn = c.id === value;
        const blurb = c.parent ? `${c.parent} · Subcategory` : blurbFor(c.name) ?? 'Main category';
        return (
          <button key={c.id} type="button" aria-pressed={isOn} onClick={() => onPick(c)} style={{
            minHeight: 62, display: 'flex', alignItems: 'center', gap: 11,
            padding: '7px 12px', textAlign: 'left',
            borderTop: i === 0 ? undefined : '1px solid var(--c-rule)',
            background: isOn ? `var(--cat-${c.tint})` : 'transparent',
            color: isOn ? `var(--cat-${c.tint}-ink)` : 'var(--c-ink)',
          }}>
            <Chip icon={c.icon} tint={isOn ? c.tint : 'neutral'} size={36} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{blurb}</span>
            </span>
            {isOn && <Icon name="check" size={18} strokeWidth={2.5} />}
          </button>
        );
      })}
    </div>
  );
}

function SmallHead({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.06em',
      textTransform: 'uppercase', color: 'var(--c-meta)',
    }}>{children}</span>
  );
}
