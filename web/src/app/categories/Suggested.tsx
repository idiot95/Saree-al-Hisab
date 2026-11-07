'use client';

import { useState, useTransition } from 'react';
import { Chip, Icon, tintOf } from '../Icon';
import { ghost } from '../form-bits';
import { haptic } from '../haptics';
import { adoptSuggested } from './actions';
import { LIBRARY, alreadyHave } from '@/lib/taxonomy';

/* The library, offered a group at a time. Each row is a parent with its
   children folded beneath it; open it to see them, and Add puts the ones
   the household lacks into the book. A group the household has in full is
   not offered. */
export default function Suggested({ have, canEdit, onResult }: {
  /** Every category name the household has, retired ones included. */
  have: string[];
  canEdit: boolean;
  onResult: (r: { ok: true; message?: string } | { ok: false; error: string }) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const groups = LIBRARY.map((g) => ({ g, ...alreadyHave(g, have) }))
    .filter(({ g, parent, children }) => !(parent && children === g.children.length));
  if (groups.length === 0) return null;

  const adopt = (name: string) => {
    haptic('select');
    setBusy(name);
    start(async () => {
      const fd = new FormData(); fd.set('group', name);
      try { onResult(await adoptSuggested(null, fd)); }
      catch { onResult({ ok: false, error: 'That could not be added. Try again.' }); }
      setBusy(null);
    });
  };

  return (
    /* Folded shut: it is a library to browse once, not part of the household's own list, and open it was most of
       a 3,000px page. Native <details>, so it opens with no script. */
    <details className="group mx-[var(--gutter)] overflow-hidden rounded-[18px] bg-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-[var(--pad)] py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="grid size-[38px] flex-none place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon name="add" size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">Suggested categories</span>
          <span className="text-subhead leading-snug text-muted-foreground">{groups.length} groups you could add, each with its subcategories</span>
        </span>
        <Icon name="expand_more" size={20} className="flex-none text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="border-t border-border px-[var(--pad)] py-3 text-subhead leading-snug text-muted-foreground">
        Add a group and it is yours to rename or retire. Nothing you already have is changed.
      </p>
      <div className="border-t border-border px-[var(--pad)]">
        {groups.map(({ g, parent, children }, i) => {
          const isOpen = open === g.name;
          const own = children + (parent ? 1 : 0);
          return (
            <div key={g.name} className={i === groups.length - 1 ? '' : 'border-b border-border'}>
              <div className="flex min-h-[60px] items-center gap-2.5">
                <button type="button" aria-expanded={isOpen}
                  onClick={() => { haptic('tap'); setOpen(isOpen ? null : g.name); }}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 py-1.5 text-left text-foreground">
                  <Chip icon={g.icon} tint={g.tint} size={38} radius={999} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-body font-semibold leading-snug [overflow-wrap:anywhere]">{g.name}</span>
                    <span className="text-subhead leading-snug text-muted-foreground">
                      {g.children.length} within{own ? ` · ${own} already yours` : ''}
                      {g.scope === 'income' ? ' · income' : ''}
                    </span>
                  </span>
                  <Icon name="expand_more" size={20} className={`flex-none text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {canEdit && (
                  <button type="button" onClick={() => adopt(g.name)} disabled={busy !== null}
                    aria-label={`Add ${g.name}`}
                    className={`press flex min-h-11 flex-none items-center gap-1 rounded-full border border-border bg-card px-3.5 text-body font-semibold text-primary disabled:cursor-default ${busy && busy !== g.name ? 'opacity-50' : ''}`}>
                    <Icon name="add" size={18} />{busy === g.name ? 'Adding…' : 'Add'}
                  </button>
                )}
              </div>
              {isOpen && (
                <div className="flex flex-wrap gap-1.5 pb-3.5 pl-[50px]">
                  {g.children.map((c) => {
                    const has = have.some((n) => n.trim().toLowerCase() === c.name.toLowerCase());
                    const [bg, ink] = tintOf(g.tint);
                    return (
                      /* Already yours wears the group's tint (data, so a style) and a check; the rest are plain. */
                      <span key={c.name}
                        className={`inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-footnote font-semibold ${has ? '' : 'border border-border bg-card text-foreground'}`}
                        style={has ? { background: bg, color: ink } : undefined}>
                        <Icon name={has ? 'check' : c.icon} size={14} />
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && groups.length > 1 && (
        <div className="border-t border-border p-[var(--pad)]">
          <button type="button" onClick={() => adopt('all')} disabled={busy !== null}
            className={`${ghost} w-full text-foreground ${busy ? 'opacity-60' : ''}`}>
            <Icon name="add" size={18} />{busy === 'all' ? 'Adding…' : `Add all ${groups.length} groups`}
          </button>
        </div>
      )}
    </details>
  );
}
