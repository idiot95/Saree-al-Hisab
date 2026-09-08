'use client';

import { useEffect, useRef } from 'react';

/* A bottom drawer: for the moment when a tap wants more than a row can hold
   and less than a page. It rises over the screen it came from, which stays
   visible above it under the veil, so the thing you tapped is still where
   you left it. Escape, the veil and the handle all put it back; the page
   under it stops scrolling while it is up; the keyboard lands on the close
   button and goes back where it was. Above the tab bar on purpose — a
   drawer is a question, and the bar's answers are not the ones it wants. */
export default function Sheet({ open, onClose, label, children }: {
  open: boolean; onClose: () => void; label: string; children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const from = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = was;
      from?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="veil" role="presentation" onClick={onClose} style={{ zIndex: 41 }} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sheet el2" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 42,
        maxHeight: '86dvh', display: 'flex', flexDirection: 'column',
        background: 'var(--c-card)', color: 'var(--c-ink)', borderRadius: '24px 24px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* The handle is the whole top edge, and a real button: it closes. */}
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" style={{
          minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', flex: 'none', borderRadius: '24px 24px 0 0',
        }}>
          <span aria-hidden style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--c-border)' }} />
        </button>
        <div style={{ overflowY: 'auto', padding: '0 var(--gutter) 18px', overscrollBehavior: 'contain' }}>
          {children}
        </div>
      </div>
    </>
  );
}
