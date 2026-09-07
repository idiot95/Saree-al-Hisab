'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Snack, { type SnackState } from './Snack';
import { saveEntry } from './add/actions';
import { drain, dequeue, readQueue } from './add/queue';
import { format } from '@/lib/money';

/* Sends what the phone kept while it had no signal.

   Mounted once, in the root layout, so it runs on whatever screen the app
   comes back to life on — and again the moment the browser says `online`.
   Nothing here is asked of the person: the entries go, the screen refreshes
   to show them, and one line at the bottom says how many. An entry the
   server refused (its category retired while the phone was out of range) is
   the only thing that needs a decision, and it is offered one: Discard. */

const NOT_HERE = /^\/(signin|signup|join|reset|offline)(\/|$)/;

export default function SyncQueue() {
  const router = useRouter();
  const [snack, setSnack] = useState<SnackState>(null);
  const closeSnack = useCallback(() => setSnack(null), []);

  useEffect(() => {
    let live = true;
    const go = () => {
      if (NOT_HERE.test(location.pathname) || !navigator.onLine) return;
      const queue = readQueue();
      if (queue.length === 0) return;
      drain((q) => saveEntry(q)).then(({ sent }) => {
        if (!live) return;
        if (sent > 0) router.refresh();
        const stuck = readQueue().filter((q) => q.stuck);
        if (stuck.length > 0) {
          const first = stuck[0];
          setSnack({
            tone: 'error',
            text: `${format(first.amountMinor)}${first.merchant ? ` at ${first.merchant}` : ''}, kept while offline, was not accepted: ${first.stuck}`,
            action: { label: 'Discard', run: () => dequeue(first.clientRef) },
          });
        } else if (sent > 0) {
          setSnack({ text: sent === 1
            ? 'The entry kept on this phone is in the books.'
            : `${sent} entries kept on this phone are in the books.` });
        }
      }).catch(() => { /* tried; the next reconnect tries again */ });
    };
    go();
    addEventListener('online', go);
    return () => { live = false; removeEventListener('online', go); };
  }, [router]);

  return <Snack snack={snack} onClose={closeSnack} ttl={snack?.tone === 'error' ? 12000 : 6000} />;
}
