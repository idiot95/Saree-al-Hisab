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
    <>
      <Head>Suggested</Head>
      <p style={{ margin: '-4px var(--gutter) 12px', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
        A fuller set, the way the finance apps file things — each a heading with its
        sub-categories beneath. Add a group and it is yours to rename or retire.
      </p>
      <section className="el card" style={{
        margin: '0 var(--gutter) 12px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
      }}>
        {groups.map(({ g, parent, children }, i) => {
          const isOpen = open === g.name;
          const own = children + (parent ? 1 : 0);
          return (
            <div key={g.name} style={{ borderBottom: i === groups.length - 1 ? undefined : '1px solid var(--c-rule)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60 }}>
                <button type="button" aria-expanded={isOpen}
                  onClick={() => { haptic('tap'); setOpen(isOpen ? null : g.name); }}
                  style={{ flex: 1, minWidth: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--c-ink)' }}>
                  <Chip icon={g.icon} tint={g.tint} size={38} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                      {g.children.length} within{own ? ` · ${own} already yours` : ''}
                      {g.scope === 'income' ? ' · income' : ''}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: 'var(--c-meta)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'flex' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>
                {canEdit && (
                  <button type="button" className="cta" onClick={() => adopt(g.name)} disabled={busy !== null}
                    aria-label={`Add ${g.name}`} style={{
                      flex: 'none', minHeight: 40, padding: '0 14px', borderRadius: 999,
                      fontSize: 'var(--step--1)', fontWeight: 600,
                      background: `var(--cat-${g.tint}-ink)`, color: '#fff', opacity: busy && busy !== g.name ? 0.5 : 1,
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
          margin: '0 var(--gutter) 22px', width: 'calc(100% - 2 * var(--gutter))', minHeight: 50, borderRadius: 14,
          fontSize: 'var(--step-0)', fontWeight: 600, ...OFF, color: 'var(--c-ink)',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy === 'all' ? 'Adding…' : `Add all ${groups.length} groups`}
        </button>
      )}
    </>
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
