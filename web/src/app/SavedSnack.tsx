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
/* Read once per visit: Edit itself marks the id handled, and the snack showing then must not turn into the tidy-up
   (which would replace the address under Edit's own push). Forgotten when the snack's Home goes, so coming Back
   reads it afresh. */
const seen = new Map<string, 'handled' | 'fresh'>();
const once = (id: string) => {
  if (!seen.has(id)) seen.set(id, handled(id) ? 'handled' : 'fresh');
  return seen.get(id)!;
};

export default function SavedSnack({ id }: { id: string }) {
  const router = useRouter();
  const editing = useRef(false);
  const state = useSyncExternalStore(noSub, () => once(id), () => 'unknown');
  useEffect(() => () => { seen.delete(id); }, [id]);
  const [closed, setClosed] = useState(false);
  const tidy = useCallback(() => {
    replacing('/');
    router.replace('/', { scroll: false });
  }, [router]);
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
