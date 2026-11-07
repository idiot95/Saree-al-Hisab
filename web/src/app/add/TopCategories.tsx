'use client';

import { useState } from 'react';
import { Chip, Icon } from '../Icon';
import { haptic } from '../haptics';
import CategoryFinder, { type Category } from '../CategoryFinder';
import { cn } from '@/lib/utils';
import { choice } from '../choice';

/* The category, as one tap: the household's most-used categories for this kind of entry as a 4×2 grid, the last
   seat "All", which opens the finder over every category.

   Seven tiles and All, because that is what fits two rows of four at a thumb's reach on a 360px phone. The server
   ranks eight (topCategories: the last 90 days by entry count, padded with the household's own order), so a
   category picked through All — or arriving on a scan's draft — takes the seventh seat rather than vanishing: what
   is chosen is always on screen. Offline there is no ranking, so the phone's own counts stand in. */

const SEATS = 7;

export default function TopCategories({ categories, top, value, onChange, label }: {
  /** Already narrowed to the kind (fits()). */
  categories: Category[];
  /** Ids in rank order, from topCategories(); absent offline. */
  top?: string[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
}) {
  const [finding, setFinding] = useState(false);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const ranked: Category[] = top
    ? top.map((id) => byId.get(id)).filter((c): c is Category => !!c)
    : [...categories].filter((c) => (c.uses ?? 0) > 0).sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));
  // Fewer than seven used: pad with the top level in its own order, as the server does.
  for (const c of categories) {
    if (ranked.length >= SEATS) break;
    if (!c.parent_id && !ranked.includes(c)) ranked.push(c);
  }
  let seats = ranked.slice(0, SEATS);
  const chosen = value ? byId.get(value) : undefined;
  if (chosen && !seats.includes(chosen)) seats = [...seats.slice(0, SEATS - 1), chosen];

  if (categories.length === 0) {
    return (
      <p className="m-0 text-sm leading-normal text-muted-foreground">
        No categories take this kind of entry yet. Set them up under Categories.
      </p>
    );
  }

  const tile = 'flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-0.5 py-2 '
    + 'text-xs leading-tight transition-colors';

  return (
    <>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
        {seats.map((c) => {
          const isOn = c.id === value;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={isOn} data-category-tile
              onClick={() => { haptic('select'); onChange(c.id); }}
              /* The one selected look (choice.ts): primary plum, a 1px edge either way so choosing moves nothing;
                 the category's own colour stays on its icon chip. */
              style={choice(isOn)}
              className={cn(tile, 'bg-card', isOn ? 'font-semibold' : 'font-medium')}>
              <Chip icon={c.icon} tint={c.tint} size={32} radius={10} />
              <span className="line-clamp-2 w-full break-words text-center">{c.name}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => { haptic('tap'); setFinding(true); }}
          aria-haspopup="dialog" aria-label="All categories"
          className={cn(tile, 'border-dashed border-input bg-card font-medium text-muted-foreground')}>
          <span className="flex size-8 items-center justify-center"><Icon name="search" size={20} /></span>
          <span>All</span>
        </button>
      </div>
      <CategoryFinder open={finding} onClose={() => setFinding(false)} categories={categories}
        selected={value} onPick={(id) => { onChange(id); setFinding(false); }} />
    </>
  );
}
