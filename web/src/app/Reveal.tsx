'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { tokenMs } from './motion';
import { cn } from '@/lib/utils';

/* The content of a screen arriving (v3.1 P4, ux-audit C4.4): each section below the header comes up a few pixels and
   out of a light fade, one after another, so the page settles in rather than cutting in. Only on arrival — a cold
   load, or a navigation to another screen — never when the same screen is redrawn: a Save, an Undo, a swipe action,
   a chip or the month pill re-render (and sometimes remount) the screen at the same path, and a page that replayed
   its entrance after every edit would flash.

   How a mount knows: `Landed` notes the path each <Screen> was mounted at. A screen mounting at the path the last
   one was mounted at is a redraw (Home again under `/?saved=…` after the Add drawer's Save, Activity again on another
   chip); any other is an arrival. Nothing is noted on the server (effects do not run there), so the server's render
   and the first one on the phone both say "arrival", and a cold load animates from its first paint.

   The numbers are the motion tokens: --dur-2 each, --stagger between them, the fourth and later all at 3 × --stagger,
   so the whole reveal is over within --dur-4. Content is readable at once: it starts at 40% and 4px low, never
   hidden. The header never moves (frames.check holds it). Reduced motion: none of it. */

let lastScreen: string | null = null;

/** Landed's note: a <Screen> was mounted at `path`. */
export function noteScreen(path: string) { lastScreen = path; }

/** True while this screen is arriving: decided as it mounts, and over once the reveal is (--dur-4 and a frame), so a
 *  section that mounts later on the same screen (the month pill's other days, a row put back by Undo) just appears. */
export function useArrival(): boolean {
  const path = usePathname();
  const [arrive, setArrive] = useState(() => lastScreen !== path);
  useEffect(() => {
    if (!arrive) return;
    const done = setTimeout(() => setArrive(false), tokenMs('--dur-4', 300) + 50);
    return () => clearTimeout(done);
  }, [arrive]);
  return arrive;
}

/** On a container: its children come in one after another. */
const CHILDREN = '*:animate-in *:fade-in-40 *:slide-in-from-bottom-1 *:duration-(--dur-2) *:ease-out *:fill-mode-backwards motion-reduce:*:animate-none *:nth-2:[--tw-animation-delay:var(--stagger)] *:nth-3:[--tw-animation-delay:calc(var(--stagger)*2)] *:nth-[n+4]:[--tw-animation-delay:calc(var(--stagger)*3)]';
/** On one section, the i-th (from 0). */
const ITEM = 'animate-in fade-in-40 slide-in-from-bottom-1 duration-(--dur-2) ease-out fill-mode-backwards motion-reduce:animate-none';
const DELAY = ['', '[--tw-animation-delay:var(--stagger)]', '[--tw-animation-delay:calc(var(--stagger)*2)]', '[--tw-animation-delay:calc(var(--stagger)*3)]'];

export const revealItem = (i: number) => `${ITEM} ${DELAY[Math.min(i, 3)]}`;
export const revealChildren = CHILDREN;

/** A server page's section container whose children arrive in turn. */
export default function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  const arrive = useArrival();
  return <div className={cn(className, arrive && CHILDREN)}>{children}</div>;
}
