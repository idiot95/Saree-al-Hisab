'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { haptic } from './haptics';

/* Swipe a row to the left and its actions come out from under it.

   The convention every phone has taught: Mail, Messages, WhatsApp, every bank
   app. Drag a little and the buttons appear and stay; let go early and the
   row settles back; drag most of the way across and the LAST action — the
   one that matters — takes over the whole space and fires on release, with a
   click under the thumb at the exact point it became inevitable. That click
   is the whole interface: it tells you where the threshold is without a line
   drawn on the screen.

   Only one row is open at a time, and closing it is easier than opening it:
   a tap anywhere else, a tap on the row, a scroll, Escape, or the smallest
   nudge back to the right — an open row does not make you drag it the whole
   way home. A flick decides by direction alone, however short. A drag never
   turns into a tap, so a row that is also a link is not followed by
   accident. Vertical movement is left to the browser (`touch-action: pan-y`),
   which is what keeps the list scrolling at full speed: this code sees a
   horizontal drag only after it has proven to be one.

   Nothing here is the only way to do anything. Every action offered by a
   swipe is also reachable by a tap somewhere, because a gesture with no
   visible twin is a gesture nobody finds. */

export type SwipeAction = {
  label: string;
  icon: ReactNode;
  tone?: 'neutral' | 'primary' | 'danger';
  act: () => void;
};

const ACT_W = 78;        // px per action once revealed
const LOCK = 8;          // px of travel before a drag decides which axis it is on
const OPEN_AT = 0.45;    // fraction of the actions' width past which it snaps open
const FULL_AT = 0.56;    // fraction of the row's width past which the last action fires
const BACK = 18;         // px rightwards from open that is enough to close it
const FLICK = 0.5;       // px/ms — quicker than this and direction alone decides

/* A label on a filled action. --c-on-fill is dark ink, which is right on the
   light theme's salmon and unreadable on the dark theme's deep red, so danger
   carries its own ink that flips with the scheme. */
const TONE = {
  neutral: ['var(--c-sunk2)', 'var(--c-ink)'],
  primary: ['var(--c-primary-hi)', 'var(--c-on-primary)'],
  danger: ['var(--c-danger-fill)', 'var(--c-on-danger)'],
} as const;

/* The one open row, so opening another closes it. Module state on purpose:
   rows in different cards on the same screen still share it. */
let closeOpen: { id: string; fn: () => void } | null = null;

export default function SwipeRow({ actions, commit = true, children }: {
  actions: SwipeAction[];
  /** Whether a long swipe fires the last action outright. Off for anything
      that should always be a deliberate second tap. */
  commit?: boolean;
  children: ReactNode;
}) {
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const s = useRef({
    id: -1, sx: 0, sy: 0, x0: 0, x: 0, axis: '' as '' | 'x' | 'y', moved: false, w: 0, armed: false,
    lx: 0, lt: 0, v: 0,
  });

  const W = actions.length * ACT_W;
  const last = actions.length - 1;
  const id = useId();

  const close = useCallback(() => {
    setX(0); setOpen(false); setArmed(false);
    if (closeOpen?.id === id) closeOpen = null;
  }, [id]);

  // A tap anywhere outside closes an open row; so does scrolling on, or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('scroll', close, { capture: true, passive: true });
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('scroll', close, { capture: true });
      document.removeEventListener('keydown', key);
    };
  }, [open, close]);

  if (actions.length === 0) return <>{children}</>;

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const w = ref.current?.offsetWidth ?? 0;
    s.current = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, x, axis: '', moved: false, w, armed: false,
      lx: e.clientX, lt: e.timeStamp, v: 0,
    };
  };

  const move = (e: React.PointerEvent) => {
    const t = s.current;
    if (t.id !== e.pointerId) return;
    const dx = e.clientX - t.sx, dy = e.clientY - t.sy;
    if (t.axis === '') {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      t.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (t.axis === 'y') return;                        // the browser's scroll, not ours
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag(true);
    }
    if (t.axis !== 'x') return;
    t.moved = true;
    let nx = Math.min(0, t.x0 + dx);                     // never past the left edge
    if (!commit && nx < -W) nx = -W - (-W - nx) * 0.25;  // and a firm stop with no commit
    const arm = commit && t.w > 0 && -nx > t.w * FULL_AT;
    if (arm !== t.armed) { t.armed = arm; setArmed(arm); haptic(arm ? 'select' : 'tap'); }
    // Velocity over the last few pixels, so a flick is read at the moment of release.
    const dt = e.timeStamp - t.lt;
    if (dt > 0) { t.v = (e.clientX - t.lx) / dt; t.lx = e.clientX; t.lt = e.timeStamp; }
    t.x = nx;
    setX(nx);
  };

  const up = (e: React.PointerEvent, cancelled = false) => {
    const t = s.current;
    if (t.id !== e.pointerId) return;
    t.id = -1;
    if (t.axis !== 'x') return;
    setDrag(false);
    if (t.armed && !cancelled) {
      // Sweep the row fully off before the action lands; the action itself
      // almost always removes the row, and this is what "removed" looks like.
      setX(-t.w);
      haptic(actions[last].tone === 'danger' ? 'warn' : 'success');
      setTimeout(() => { close(); actions[last].act(); }, 170);
      return;
    }
    setArmed(false);
    /* Which way it settles. Started open: any nudge back to the right closes
       it, otherwise it stays. Started closed: past the threshold opens it. A
       flick in either direction wins over distance. */
    const flick = Math.abs(t.v) > FLICK ? (t.v < 0 ? 'open' : 'close') : null;
    const wasOpen = t.x0 <= -W + 1;
    const stays = cancelled ? false
      : flick ? flick === 'open'
      : wasOpen ? t.x - t.x0 < BACK
      : -t.x > W * OPEN_AT;
    if (stays) {
      setX(-W); setOpen(true);
      if (closeOpen && closeOpen.id !== id) closeOpen.fn();
      closeOpen = { id, fn: close };
    } else {
      close();
    }
  };

  // A drag must not also be a tap, and a tap on an open row only closes it.
  const click = (e: React.MouseEvent) => {
    if (!s.current.moved && !open) return;
    e.preventDefault(); e.stopPropagation();
    s.current.moved = false;
    if (open) close();
  };

  return (
    <div ref={ref} style={{
      position: 'relative', overflow: 'hidden', margin: '0 calc(var(--pad) * -1)',
    }}>
      <div aria-hidden={!open} style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, display: 'flex',
        width: Math.max(W, -x),
      }}>
        {actions.map((a, i) => {
          const [bg, ink] = TONE[a.tone ?? 'neutral'];
          const fires = armed && i === last;
          return (
            <button key={a.label} type="button" tabIndex={open ? 0 : -1}
              onClick={() => { close(); a.act(); }}
              style={{
                flex: fires ? '1 1 100%' : armed ? '0 0 0px' : '1 1 0',
                minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                paddingLeft: fires ? 26 : 0, alignSelf: 'stretch',
                background: bg, color: ink, opacity: armed && !fires ? 0 : 1,
                fontSize: 'var(--step--2)', fontWeight: 600, letterSpacing: '.01em',
                transition: 'flex .16s ease, opacity .12s ease, padding .16s ease',
                ...(fires ? { alignItems: 'flex-start' } : {}),
              }}>
              {a.icon}
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>

      <div
        onPointerDown={down} onPointerMove={move}
        onPointerUp={up} onPointerCancel={(e) => up(e, true)}
        onClickCapture={click}
        style={{
          position: 'relative', padding: '0 var(--pad)', background: 'var(--c-card)',
          touchAction: 'pan-y',
          transform: `translateX(${x}px)`,
          transition: drag ? 'none' : 'transform .24s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
