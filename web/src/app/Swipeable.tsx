'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SwipeRow, { type SwipeAction } from './SwipeRow';
import Snack, { type SnackState } from './Snack';
import { Icon } from './Icon';

/* A swipe row a server page can use.

   `SwipeRow` wants functions, and a server component cannot hand a client
   one a function — so this takes what it can be handed: a place to go, or a
   server action with the fields to send it. Both are things the row already
   offers by tap somewhere on the screen; the swipe is the short way there.

   An action that answers `{ ok: false }` is shown at the bottom, the same
   line the entries screen uses for Undo, and the page is re-read on success
   so the row reflects what the server now says. */

export type Swipe = {
  label: string;
  icon: string;
  tone?: 'neutral' | 'primary' | 'danger';
  /** Where a swipe goes — always one of our own paths, written by us. */
  href?: string;
  /** Or what it does: a server action taking (prevState, formData) … */
  act?: (prev: null, fd: FormData) => Promise<{ ok: boolean; error?: string } | null | void>;
  /** … with these fields, and this to say once it is done. */
  fields?: Record<string, string>;
  done?: string;
};

export default function Swipeable({ actions, commit = true, children }: {
  actions: Swipe[]; commit?: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [snack, setSnack] = useState<SnackState>(null);
  const closeSnack = useCallback(() => setSnack(null), []);

  const rows: SwipeAction[] = actions.map((a) => ({
    label: a.label,
    tone: a.tone,
    icon: <Icon name={a.icon} size={20} strokeWidth={2} />,
    act: () => {
      if (a.href) { router.push(a.href, { transitionTypes: ['nav-forward'] }); return; }
      if (!a.act) return;
      const fd = new FormData();
      for (const [k, v] of Object.entries(a.fields ?? {})) fd.append(k, v);
      start(async () => {
        const r = await a.act!(null, fd);
        if (r && r.ok === false) { setSnack({ text: r.error ?? 'That did not go through.', tone: 'error' }); return; }
        if (a.done) setSnack({ text: a.done });
        router.refresh();
      });
    },
  }));

  return (
    <>
      <SwipeRow actions={rows} commit={commit}>{children}</SwipeRow>
      <Snack snack={snack} onClose={closeSnack} />
    </>
  );
}
