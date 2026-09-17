'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from './haptics';

/* A bottom drawer: for the moment when a tap wants more than a row can hold
   and less than a page. It rises over the screen it came from, which stays
   visible above it under the veil, so the thing you tapped is still where
   you left it. Escape, the veil and the handle all put it back; the page
   under it stops scrolling while it is up; the keyboard lands on the close
   button and goes back where it was. Above the tab bar on purpose — a
   drawer is a question, and the bar's answers are not the ones it wants.

   It moves the way an iPhone sheet does. It springs up from the bottom edge,
   and it goes back down the way it came rather than vanishing — whoever closes
   it, the parent included, since it stays mounted for the length of the exit.
   Drag the handle and the sheet follows the finger; let go past a third of
   the way, or with a flick, and it closes; otherwise it springs back. */
export default function Sheet({ open, onClose, label, focus, children }: {
  open: boolean; onClose: () => void; label: string; children: React.ReactNode;
  /** Where the keyboard lands when the drawer opens, if not the handle — a
      search box, say, whose whole point is to be typed into at once. */
  focus?: React.RefObject<HTMLElement | null>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Still on screen while it slides out: mounted follows `open` up at once,
     and down only when the exit animation has finished. Worked out during
     render from the previous `open`, so no effect has to set state. */
  const [mounted, setMounted] = useState(open);
  const [was, setWas] = useState(open);
  if (open !== was) {
    setWas(open);
    if (open) setMounted(true);
  }
  const leaving = mounted && !open;

  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const grab = useRef<{ id: number; y: number; t: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const from = document.activeElement as HTMLElement | null;
    (focus?.current ?? closeRef.current)?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = was;
      from?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, focus]);

  if (!mounted) return null;

  const down = (e: React.PointerEvent) => {
    if (leaving) return;
    grab.current = { id: e.pointerId, y: e.clientY, t: e.timeStamp, moved: false };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y;
    if (Math.abs(dy) > 4) g.moved = true;
    // Downwards it follows the finger; upwards it resists, the way a sheet
    // already at the top does.
    setDrag(dy > 0 ? dy : dy / 5);
  };
  const up = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y;
    const v = dy / Math.max(1, e.timeStamp - g.t);
    const height = dialogRef.current?.offsetHeight ?? 400;
    if (g.moved && (dy > height / 3 || (dy > 24 && v > 0.6))) {
      haptic('tap');
      onClose();
    } else {
      setDrag(0);
    }
    setDragging(false);
    setTimeout(() => { grab.current = null; }, 0);
  };

  return (
    <>
      <div className="veil" role="presentation" data-leaving={leaving || undefined}
        onClick={leaving ? undefined : onClose}
        style={{ zIndex: 41, pointerEvents: leaving ? 'none' : undefined }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={label}
        className="sheet el2" data-leaving={leaving || undefined}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && leaving) { setMounted(false); setDrag(0); }
        }}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 42,
          maxHeight: '86dvh', display: 'flex', flexDirection: 'column',
          background: 'var(--c-card)', color: 'var(--c-ink)', borderRadius: '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: drag ? `translateY(${drag}px)` : undefined,
          transition: dragging ? 'none' : 'transform .45s var(--ease-ios)',
        }}>
        {/* The handle is the whole top edge, and a real button: tap it and it
            closes, drag it and the sheet comes with you. */}
        <button ref={closeRef} type="button" aria-label="Close"
          onClick={() => { if (!grab.current?.moved && !leaving) onClose(); }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up}
          onPointerCancel={() => { grab.current = null; setDragging(false); setDrag(0); }}
          style={{
            minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', flex: 'none', borderRadius: '24px 24px 0 0',
            touchAction: 'none', cursor: 'grab',
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
