'use client';

import { useState, useTransition } from 'react';
import { Chip, Icon } from '../Icon';
import { haptic } from '../haptics';
import { adoptSuggested } from './actions';
import { LIBRARY, alreadyHave } from '@/lib/taxonomy';
import { OFF } from '../choice';

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
    <details className="mx-[var(--gutter)] mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">Suggested categories</span>
          <span className="text-xs text-muted-foreground">{groups.length} groups you could add, each with its subcategories</span>
        </span>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted-foreground"
          strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Add a group and it is yours to rename or retire. Nothing you already have is changed.
      </p>
      <section style={{ padding: '0 var(--pad)', borderTop: '1px solid var(--border)' }}>
        {groups.map(({ g, parent, children }, i) => {
          const isOpen = open === g.name;
          const own = children + (parent ? 1 : 0);
          return (
            <div key={g.name} style={{ borderBottom: i === groups.length - 1 ? undefined : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60 }}>
                <button type="button" aria-expanded={isOpen}
                  onClick={() => { haptic('tap'); setOpen(isOpen ? null : g.name); }}
                  style={{ flex: 1, minWidth: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--foreground)' }}>
                  <Chip icon={g.icon} tint={g.tint} size={38} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                      {g.children.length} within{own ? ` · ${own} already yours` : ''}
                      {g.scope === 'income' ? ' · income' : ''}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: 'var(--muted-foreground)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'flex' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>
                {canEdit && (
                  <button type="button" className="cta" onClick={() => adopt(g.name)} disabled={busy !== null}
                    aria-label={`Add ${g.name}`} style={{
                      flex: 'none', minHeight: 44, padding: '0 16px', borderRadius: 999,
                      fontSize: 'var(--step--1)', fontWeight: 600, ...OFF, color: 'var(--primary)',
                      opacity: busy && busy !== g.name ? 0.5 : 1,
                    }}>
                    {busy === g.name ? 'Adding…' : 'Add'}
                  </button>
                )}
              </div>
              {isOpen && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 0 14px 50px' }}>
                  {g.children.map((c) => {
                    const has = have.some((n) => n.trim().toLowerCase() === c.name.toLowerCase());
                    return (
                      <span key={c.name} style={{
                        minHeight: 32, padding: '0 10px 0 8px', borderRadius: 999, display: 'inline-flex',
                        alignItems: 'center', gap: 5, fontSize: 'var(--step--2)', fontWeight: 600,
                        ...(has ? { background: `var(--cat-${g.tint})`, color: `var(--cat-${g.tint}-ink)` } : OFF),
                      }}>
                        <Icon name={c.icon} size={14} strokeWidth={1.9} />
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>
      {canEdit && groups.length > 1 && (
        <button type="button" className="cta" onClick={() => adopt('all')} disabled={busy !== null} style={{
          margin: '12px var(--pad) 14px', width: 'calc(100% - 2 * var(--pad))', minHeight: 50, borderRadius: 14,
          fontSize: 'var(--step-0)', fontWeight: 600, ...OFF, color: 'var(--foreground)',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy === 'all' ? 'Adding…' : `Add all ${groups.length} groups`}
        </button>
      )}
    </details>
  );
}
