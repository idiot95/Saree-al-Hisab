'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AddEntry from '../../add/AddEntry';
import AddDrawer from './AddDrawer';
import { feedInstant, instantState, isCancelled, serverInstant, subscribeInstant, takeCancelled, type AddProps } from '../../add/instant';

/* The intercepted /add, once the server has answered. Opened from the tab bar, the drawer is already up
   (InstantAdd, from the phone's own pickers): this hands it what the server loaded and draws nothing of its own, so
   there is one drawer and the digits already typed stay. Put away before the server answered, it steps back off
   the address it just arrived at. Opened any other way — a card's Pay, a tab's Add cost, a bank message's Review,
   forward through history — there is no drawer yet, and this is it. */
export default function AddSheet(props: AddProps) {
  const router = useRouter();
  const s = useSyncExternalStore(subscribeInstant, instantState, serverInstant);
  /* Once the tab bar's drawer has had this page's props it keeps them: put away, it slides off while the address
     steps back, and this must not open a second drawer in the meantime. */
  const [handed, setHanded] = useState(false);
  // Only the tab bar's plain /add can be the one put away early; a Pay or an Add cost carries a query.
  const plain = useSearchParams().toString() === '';
  const [ours] = useState(() => isCancelled(instantState(), plain));
  const owned = s.open || ours || handed;
  if (owned && !handed) setHanded(true);

  useEffect(() => {
    if (takeCancelled(plain) && ours) { router.back(); return; }
    feedInstant(props);
  }, [props, router, plain, ours]);

  if (owned) return null;
  return (
    <AddDrawer>
      <AddEntry {...props} sheet />
    </AddDrawer>
  );
}
