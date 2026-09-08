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
   way home. The tap that closes it does nothing else: it was aimed at
   closing, and the button or link that happened to be under the thumb is
   not pressed as well. (Mail gets this right and half the apps that copied
   it get it wrong, and the wrong version is the one where closing a row
   opens something.) A flick decides by direction alone, however short. A
   drag never turns into a tap, so a row that is also a link is not followed
   by accident. Vertical movement is left to the browser (`touch-action:
   pan-y`), which is what keeps the list scrolling at full speed: this code
   sees a horizontal drag only after it has proven to be one.

   A gesture with no visible twin is a gesture nobody finds, so a row that
   can be swiped SAYS so: a small chevron at its right edge, the same mark
   every phone uses for "there is more this way". It is also the twin —
   tapping it opens the actions, tapping again tucks them away — so nothing
   here is reachable by gesture only, and a row does not need a second set
   of buttons under it repeating what the swipe offers. The first swipe row
   a household ever sees also peeks its actions out and back, once, which is
   how most people learn a swipe exists at all. */

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

/* Whether this page load has already shown the peek. One row per screen is
   a lesson; every row would be a tic. Whether this DEVICE has seen it is in
   localStorage, and is read only from an effect — storage is a browser thing,
   and a first paint that depended on it could not match the server's. */
let peekedThisLoad = false;
const PEEK_KEY = 'swipe-peeked';

export default function SwipeRow({ actions, commit = true, grip = true, flush = false,
  gripColor = 'var(--c-meta)', children }: {
  actions: SwipeAction[];
  /** Whether a long swipe fires the last action outright. Off for anything
      that should always be a deliberate second tap. */
  commit?: boolean;
  /** The chevron at the right edge that shows the row can be swiped and
      opens it on a tap. Off only where the row already wears a handle of
      its own at that edge. */
  grip?: boolean;
  /** Let a shaped block such as a credit card reach the swipe row's edges. */
  flush?: boolean;
  /** A shaped block can put the grip on a dark ground. */
  gripColor?: string;
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

  const show = useCallback(() => {
    setX(-W); setOpen(true);
    if (closeOpen && closeOpen.id !== id) closeOpen.fn();
    closeOpen = { id, fn: close };
  }, [W, id, close]);

  // A tap anywhere outside closes an open row; so does scrolling on, or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return;
      close();
      /* The tap that closed it ends here. The click it is about to become
         is eaten at the capture stage, before any button or link under the
         thumb hears it. The eater is removed again shortly after the pointer
         lifts, so a press that turned into a scroll (no click at all) does
         not leave it waiting to eat the next, unrelated tap. */
      const eat = (c: Event) => { c.stopPropagation(); c.preventDefault(); };
      document.addEventListener('click', eat, { capture: true, once: true });
      const drop = () => { setTimeout(() => document.removeEventListener('click', eat, true), 400); };
      document.addEventListener('pointerup', drop, { once: true });
      document.addEventListener('pointercancel', drop, { once: true });
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

  // The once-only peek: the first swipe row of a first visit slides its
  // actions out a little and lets them settle back.
  useEffect(() => {
    if (actions.length === 0 || peekedThisLoad) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    try {
      if (localStorage.getItem(PEEK_KEY)) return;
      localStorage.setItem(PEEK_KEY, '1');
    } catch { return; }
    peekedThisLoad = true;
    const out = setTimeout(() => setX(-Math.min(W, 56)), 700);
    const back = setTimeout(() => setX(0), 1500);
    return () => { clearTimeout(out); clearTimeout(back); };
  }, [actions.length, W]);

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
    if (stays) show(); else close();
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
      position: 'relative', overflow: 'hidden',
      margin: flush ? 0 : '0 calc(var(--pad) * -1)',
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
          position: 'relative', background: 'var(--c-card)',
          padding: flush ? 0 : grip ? '0 calc(var(--pad) + 20px) 0 var(--pad)' : '0 var(--pad)',
          touchAction: 'pan-y',
          transform: `translateX(${x}px)`,
          transition: drag ? 'none' : 'transform .24s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {children}
        {grip && (
          <button type="button" aria-label={open ? 'Hide actions' : 'Show actions'} aria-expanded={open}
            onClick={() => { if (!s.current.moved) { haptic('tap'); show(); } }}
            style={{
              position: 'absolute', top: 0, bottom: 0, right: 0, width: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: gripColor, opacity: 0.8,
            }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
