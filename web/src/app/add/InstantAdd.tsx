'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AddEntry from './AddEntry';
import AddDrawer from '../@modal/(.)add/AddDrawer';
import { AddFrame } from '../Skeleton';
import { closeInstant, freshPickers, instantState, markLanded, serverInstant, subscribeInstant } from './instant';
import { nothing, snapshotPickers, subscribe as subscribeDevice } from './queue';

/* The Add drawer the tab bar's plus opens, on the tap (see instant.ts). Until the route's props arrive it is drawn
   from the pickers this phone kept the last time Add opened with signal — this household's, and recent — or, on a
   phone that has none, as the form's frame inside the drawer. Either way the drawer itself is the feedback: nothing
   full-screen flashes behind it. Lives in the root layout beside the @modal slot, inside the currency provider. */

const localToday = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function InstantAdd({ householdId }: { householdId: string }) {
  const s = useSyncExternalStore(subscribeInstant, instantState, serverInstant);
  const stored = useSyncExternalStore(subscribeDevice, snapshotPickers, nothing);
  const path = usePathname();
  const router = useRouter();

  /* The address reached /add, and later left it — Save went Home or to a tab, Back, the browser's back: the drawer
     goes with it. */
  useEffect(() => {
    if (!s.open) return;
    if (path === '/add') markLanded();
    else if (s.landed) closeInstant();
  }, [path, s.open, s.landed]);

  const close = () => { if (closeInstant()) router.back(); };

  const cached = s.fed ? null : freshPickers(stored, householdId);
  return (
    <AddDrawer open={s.open} onClose={close}>
      {s.fed ? (
        <AddEntry key={s.session} {...s.fed} sheet onClose={close} />
      ) : cached ? (
        <AddEntry key={s.session} sheet cached onClose={close}
          categories={cached.categories} ways={cached.ways ?? []} tabs={cached.tabs ?? []} top={cached.top}
          paidWith={cached.paidWith} householdId={cached.householdId} today={localToday()} />
      ) : (
        <AddFrame sheet />
      )}
    </AddDrawer>
  );
}
