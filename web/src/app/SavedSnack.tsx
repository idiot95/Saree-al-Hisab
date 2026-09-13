'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Snack, { type SnackState } from './Snack';
import { startPending } from './pending';

/* "Saved", with Edit on it, the moment Add Entry lands back on Home.

   The commonest correction is the one noticed straight after saving — the
   wrong category, a zero too many — and until now fixing it meant finding
   the entry again in a month of others. The line at the bottom says what just
   happened and offers the one thing a person might want next. When it goes,
   the ?saved= comes off the address so a reload does not say it twice. */
export default function SavedSnack({ id }: { id: string }) {
  const router = useRouter();
  const [snack, setSnack] = useState<SnackState>(() => ({
    text: 'Entry saved.',
    action: { label: 'Edit', run: () => { startPending(`/entries/${id}`); router.push(`/entries/${id}?from=/`, { transitionTypes: ['nav-forward'] }); } },
  }));
  const close = useCallback(() => {
    setSnack(null);
    router.replace('/', { scroll: false });
  }, [router]);
  return <Snack snack={snack} onClose={close} />;
}
