'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Snack, { type SnackState } from './Snack';
import { startPending } from './pending';
import { replacing } from './backStack';

/* "Saved", with Edit on it, the moment Add Entry lands back on Home.

   The commonest correction is the one noticed straight after saving — the
   wrong category, a zero too many — and until now fixing it meant finding
   the entry again in a month of others. The line at the bottom says what just
   happened and offers the one thing a person might want next. When it goes,
   the ?saved= comes off the address so a reload does not say it twice.

   One navigation per gesture, so each keeps its own Back mark: Edit pushes the
   entry and nothing else (closing the snack then navigates nowhere). The
   ?saved= address it leaves behind is noted as handled, so coming Back to it
   says nothing and only takes the ?saved= off (a replace, marked). */
const DONE = 'ql.saved.done';
const handled = (id: string) => { try { return sessionStorage.getItem(DONE) === id; } catch { return false; } };

/* Whether this ?saved= was dealt with, as the phone's storage says. The server (and the first render on the phone,
   which must match it) cannot know, so it says 'unknown' and nothing is drawn; only the phone's own answer, 'fresh',
   draws the snack. Back on a handled ?saved= therefore never shows "Entry saved." even for a frame. */
const noSub = () => () => {};

export default function SavedSnack({ id }: { id: string }) {
  const router = useRouter();
  const editing = useRef(false);
  /* The phone's answer is read once per instance and kept: Edit itself marks the id handled, and the snack showing
     then must not turn into the tidy-up (which would replace the address under Edit's own push). A ref, not a module
     cache cleared on unmount, because StrictMode's simulated unmount in `next dev` runs that cleanup straight after
     mount, and the next re-render (Edit's close) would have read 'handled'. A ref survives the simulated remount; a
     real one (coming Back to this ?saved=) is a new instance and reads afresh. Keyed by id, so a new ?saved= on the
     same instance is read for itself. */
  const answer = useRef<{ id: string; v: 'handled' | 'fresh' } | null>(null);
  const read = useCallback(() => {
    if (answer.current?.id !== id) answer.current = { id, v: handled(id) ? 'handled' : 'fresh' };
    return answer.current.v;
  }, [id]);
  const state = useSyncExternalStore(noSub, read, () => 'unknown');
  const [closed, setClosed] = useState(false);
  /* One tidy per id: StrictMode runs the effect below twice, and the second must not send a second replace. */
  const tidied = useRef<string | null>(null);
  const tidy = useCallback(() => {
    if (tidied.current === id) return;
    tidied.current = id;
    replacing('/');
    router.replace('/', { scroll: false });
  }, [router, id]);
  const snack = useMemo<SnackState>(() => (state !== 'fresh' || closed ? null : {
    text: 'Entry saved.',
    check: true,
    action: {
      label: 'Edit',
      run: () => {
        editing.current = true;
        try { sessionStorage.setItem(DONE, id); } catch { /* only costs a repeat of the snack */ }
        startPending(`/entries/${id}`);
        router.push(`/entries/${id}?from=/`, { transitionTypes: ['nav-forward'] });
      },
    },
  }), [state, closed, id, router]);
  // Back on a ?saved= already dealt with: just the clean address (Home then renders without this component).
  useEffect(() => { if (state === 'handled') tidy(); }, [state, tidy]);
  const close = useCallback(() => {
    setClosed(true);
    if (!editing.current) tidy();
  }, [tidy]);
  return <Snack snack={snack} onClose={close} />;
}
