'use client';

import { useEffect } from 'react';
import { haptic } from './haptics';

/* A line at the bottom of the screen that says what just happened and, when
   it can be taken back, offers to.

   This is the safety net under every swipe. A confirm dialog before a delete
   asks "are you sure?" of somebody who is always sure — and then gets in the
   way of the hundred deletes that were fine to protect the one that was not.
   Undo protects the one, and costs the hundred nothing. Six seconds, sitting
   just above the tab bar where the thumb already is. */

export type SnackState = {
  text: string; undo?: () => void; tone?: 'ok' | 'error';
  /** A named action in Undo's place, for a snack that offers something else. */
  action?: { label: string; run: () => void };
} | null;

export default function Snack({ snack, onClose, ttl = 6000 }: {
  snack: SnackState; onClose: () => void; ttl?: number;
}) {
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(onClose, ttl);
    return () => clearTimeout(t);
  }, [snack, onClose, ttl]);

  if (!snack) return null;
  const err = snack.tone === 'error';
  return (
    <div role="status" aria-live="polite" className="snack" style={{
      position: 'fixed', left: 'var(--gutter)', right: 'var(--gutter)', zIndex: 45,
      bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
      minHeight: 52, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 6px 0 16px', borderRadius: 14,
      background: err ? 'var(--c-danger)' : 'var(--c-ink)', color: '#fff',
      boxShadow: '0 8px 24px -8px rgba(35,61,77,.45)',
    }}>
      <span style={{ flex: 1, fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.35 }}>
        {snack.text}
      </span>
      {(snack.undo || snack.action) && (
        <button className="cta" type="button" style={{
          minHeight: 44, padding: '0 14px', borderRadius: 10, fontSize: 'var(--step--1)',
          fontWeight: 700, color: 'var(--c-pollen)', letterSpacing: '.01em', flex: 'none',
        }} onClick={() => { haptic('select'); (snack.undo ?? snack.action?.run)?.(); onClose(); }}>
          {snack.undo ? 'Undo' : snack.action?.label}
        </button>
      )}
    </div>
  );
}
