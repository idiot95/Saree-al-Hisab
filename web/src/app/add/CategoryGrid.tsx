'use client';

import { useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { CHIP, CHIP_TEXT } from '../PayPicker';
import { OFF, on } from '../choice';
import { blurbFor } from '@/lib/taxonomy';
import type { Category } from '../CategoryFinder';

/* The second page of Add Entry: what the money was for.

   Every category is a card, the way the finance apps of the day draw one:
   the family's tinted icon, its name, a line in plain words saying what
   belongs in it, and beneath that its children as icons with their names
   under them. Seeing "Vegetables, Fruit, Meat & fish" without tapping is the
   whole point — a person who does not know whether the thaali is Faith or
   Eating out can read the answer instead of guessing.

   Two rules of the house differ from the apps this borrows from. Children
   WRAP rather than scrolling sideways, because a row that runs off the edge
   hides options and what is offered should be countable. And nothing wears a
   colour until it is the answer, so the one coloured thing on the page is
   what was chosen: a chosen child fills in its own ink and leaves its parent
   in a light wash, which reads as "Groceries, and within it Milk".

   Above the cards sit the few categories this household actually uses. A book
   with forty headings has four that carry the entries, and scrolling past
   thirty-six of them to reach the fourth is the tax this row removes. Below
   that, a search box narrows the whole tree as you type; the filter runs over
   rows already on the phone, so it works offline. */
export default function CategoryGrid({ categories, value, onChange, label }: {
  categories: Category[]; value: string | null; onChange: (id: string | null) => void;
  label: string;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const tops = categories.filter((c) => !c.parent_id);
  const chosen = categories.find((c) => c.id === value) ?? null;
  const familyId = chosen ? chosen.parent_id ?? chosen.id : null;
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

  /* Most used: the handful with the most entries behind them, whatever their
     level — a household that always picks "Milk & dairy" gets the child, one
     that stops at "Groceries" gets the parent. Four, because five chips wrap
     onto a second line on a small phone and this row is meant to be a
     shortcut, not a second list. Never shown until there is real use behind
     it: on a fresh book every count is zero and the row would be arbitrary. */
  const favourites = categories
    .filter((c) => (c.uses ?? 0) > 0)
    .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
    .slice(0, 4);

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
          {favourites.length >= 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{
                fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.06em',
                textTransform: 'uppercase', color: 'var(--c-meta)',
              }}>Most used</span>
              <div role="group" aria-label="Most used categories"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {favourites.map((c) => {
                  const isOn = c.id === value;
                  const ink = `var(--cat-${c.tint}-ink)`;
                  return (
                    <button key={c.id} type="button" aria-pressed={isOn}
                      onClick={() => pick(isOn ? c.parent_id ?? null : c.id)}
                      style={{ ...CHIP, ...(isOn ? on(ink) : OFF) }}>
                      <Icon name={c.icon} size={16} strokeWidth={1.9} />
                      <span style={CHIP_TEXT}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tops.map((c) => {
            const kids = categories.filter((k) => k.parent_id === c.id);
            const isOn = c.id === value;
            const wash = !isOn && c.id === familyId;
            const ink = `var(--cat-${c.tint}-ink)`;
            const blurb = blurbFor(c.name);
            return (
              <section key={c.id} style={{
                borderRadius: 16, background: 'var(--c-card)', border: '1px solid var(--c-border)',
                padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <button type="button" aria-pressed={isOn} onClick={() => pick(isOn ? null : c.id)}
                  style={{
                    minHeight: 56, padding: '8px 10px', borderRadius: 12, display: 'flex',
                    alignItems: 'center', gap: 11, transition: 'background .15s, color .15s',
                    ...(isOn ? on(ink) : wash
                      ? { background: `var(--cat-${c.tint})`, color: ink, border: `1px solid ${ink}` }
                      : OFF),
                  }}>
                  <Icon name={c.icon} size={22} strokeWidth={1.9} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 'var(--step-0)', fontWeight: 700, lineHeight: 1.2 }}>{c.name}</span>
                    {blurb && (
                      <span style={{
                        fontSize: 'var(--step--2)', lineHeight: 1.25, fontWeight: 500,
                        color: isOn ? 'inherit' : 'var(--c-meta)', opacity: isOn ? 0.82 : 1,
                      }}>{blurb}</span>
                    )}
                  </span>
                  {isOn && <Icon name="check" size={18} strokeWidth={2.4} />}
                </button>

                {kids.length > 0 && (
                  <div role="group" aria-label={`Within ${c.name}`} style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4,
                  }}>
                    {kids.map((k) => {
                      const kidOn = k.id === value;
                      const kidInk = `var(--cat-${k.tint}-ink)`;
                      return (
                        <button key={k.id} type="button" aria-pressed={kidOn}
                          onClick={() => pick(kidOn ? c.id : k.id)}
                          style={{ ...KID, ...(kidOn ? on(kidInk) : KID_OFF) }}>
                          <Icon name={k.icon} size={21} strokeWidth={1.8} />
                          <span style={KID_LABEL}>{k.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/* A child: its icon over its name, the shape a phone's app drawer uses, so
   the eye reads the row as pictures rather than as a wall of words. */
const KID: React.CSSProperties = {
  minHeight: 72, padding: '9px 3px', borderRadius: 12, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center',
  transition: 'background .15s, color .15s',
};
/* Unchosen children sit on the card, not on the page, so they take no fill of
   their own — a grey block behind every one of a hundred and fifty children
   turns the screen into a chessboard. The name carries them until one is
   picked, and then it alone is coloured. */
const KID_OFF: React.CSSProperties = {
  background: 'transparent', color: 'var(--c-meta)', border: '1px solid transparent',
};
const KID_LABEL: React.CSSProperties = {
  fontSize: 'var(--step--2)', fontWeight: 600, lineHeight: 1.15, maxWidth: '100%',
  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  overflowWrap: 'anywhere',
};
