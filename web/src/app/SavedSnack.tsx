'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function SavedSnack({ id }: { id: string }) {
  const router = useRouter();
  const editing = useRef(false);
  const tidy = useCallback(() => {
    replacing('/');
    router.replace('/', { scroll: false });
  }, [router]);
  const [snack, setSnack] = useState<SnackState>(() => ({
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
  }));
  /* Back on a ?saved= already dealt with: just the clean address (Home then renders without this snack). Read in an
     effect, not the first render, so the server's markup and the phone's agree. */
  useEffect(() => { if (handled(id)) tidy(); }, [id, tidy]);
  const close = useCallback(() => {
    setSnack(null);
    if (!editing.current) tidy();
  }, [tidy]);
  return <Snack snack={snack} onClose={close} />;
}
