'use client';

import { useEffect, useSyncExternalStore } from 'react';
import AddEntry from '../add/AddEntry';
import { subscribe, snapshotPickers, snapshotQueue, nothing, none, dequeue, type Queued } from '../add/queue';
import { useMoney } from '@/app/currency';
import { haptic } from '../haptics';
import { forcedTheme, THEME_COOKIE } from '@/lib/theme';
import { Icon } from '../Icon';
import { quietBtn } from '../auth-ui';
import { cn } from '@/lib/utils';
import { liRule } from '../form-bits';
import * as Calendar from '../HijriCalendar';
import { primeCalendar } from '../LazyCalendar';

/* Without signal there is nothing to fetch a chunk from, and the worker keeps only the chunks this page names. So
   the month grid (loaded on demand everywhere else) is bundled into this page and handed to the loader. */
primeCalendar(Calendar);

/* What the app is when there is no signal.

   Before: a page that said "no connection, try again" — true, and useless at
   the till, which is the one place an entry is most worth writing down. Now
   it is Add Entry, drawn from the names the phone kept the last time the
   form was opened online, and every save goes to the phone's queue. The
   layout sends the queue the moment signal returns.

   Everything on this screen is read from the phone AFTER the page has come
   up: the page itself is a cached shell holding nothing, because a cached
   page with household data in it would be household data on disk. */

const localToday = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function OfflineScreen() {
  const pickers = useSyncExternalStore(subscribe, snapshotPickers, nothing);
  const queue = useSyncExternalStore(subscribe, snapshotQueue, none);

  /* The shell was cached without cookies, so the layout could not stamp the
     chosen scheme on it. The cookie is still on the phone; read it here so a
     dark ledger does not flash light at the till. */
  useEffect(() => {
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${THEME_COOKIE}=`));
    const forced = forcedTheme(raw?.slice(THEME_COOKIE.length + 1));
    if (!forced) return;
    document.documentElement.dataset.theme = forced;
    document.documentElement.style.colorScheme = forced;
  }, []);

  const ways = pickers?.ways ?? [];
  if (!pickers || ways.length === 0) return <Bare queue={queue} />;

  return (
    <AddEntry offline
      categories={pickers.categories} ways={ways}
      tabs={pickers.tabs ?? []} top={pickers.top} paidWith={pickers.paidWith}
      householdId={pickers.householdId} today={localToday()}
      onQueued={() => { /* the store's own event re-renders the list below */ }}
    >
      <Banner />
      <Pending queue={queue} />
    </AddEntry>
  );
}

function Banner() {
  return (
    <div className="mx-[var(--gutter)] mb-3 flex items-center gap-2.5 rounded-[14px] bg-attention-soft py-2 pr-1.5 pl-3.5 text-body font-semibold leading-snug text-attention-soft-foreground">
      <Icon name="wifi_off" size={20} />
      <span className="flex-1">
        No connection. Entries saved here stay on this phone and go into the books when signal
        is back.
      </span>
      {/* A real navigation, not a client-side one: the service worker
          answers it from the network if there is one, and with this page
          again if there is not. A <Link> would only fetch a payload. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="flex min-h-11 flex-none items-center px-2.5 font-bold underline underline-offset-[3px]">Retry</a>
    </div>
  );
}

function Pending({ queue }: { queue: Queued[] }) {
  const { format } = useMoney();
  if (queue.length === 0) return null;
  return (
    <section aria-label="Waiting to be sent" className="mx-[var(--gutter)] mb-3 flex flex-col gap-1.5">
      <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">Waiting for signal · {queue.length}</h2>
      <ul className="overflow-hidden rounded-[20px] bg-card shadow-card">
        {queue.map((q) => (
          <li key={q.clientRef} className={`flex min-h-[52px] items-center gap-2.5 pl-[var(--pad)] ${liRule} [--rule-x:var(--pad)]`}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
              <span className="text-body font-semibold [overflow-wrap:anywhere]">
                {q.kind === 'income' ? 'Income' : q.kind === 'transfer' ? 'Move' : (q.merchant || 'Expense')}
                <span className="font-medium text-muted-foreground"> · {q.occurredOn}</span>
              </span>
              {q.stuck && (
                <span className="inline-flex items-start gap-1 text-footnote text-destructive">
                  <Icon name="error" size={14} className="mt-px" />Not accepted: {q.stuck}
                </span>
              )}
            </span>
            <span className="flex-none text-body font-semibold tabular-nums">{format(q.amountMinor)}</span>
            <button type="button" aria-label={`Discard ${format(q.amountMinor)}`}
              onClick={() => { haptic('select'); dequeue(q.clientRef); }}
              className="press grid size-11 flex-none place-items-center rounded-full text-muted-foreground in-data-[platform=android]:size-12">
              <Icon name="close" size={20} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Nothing kept on this phone yet: the form cannot be offered, because it
   would have no categories to offer. Say what would make it work next time. */
function Bare({ queue }: { queue: Queued[] }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-[var(--gutter)] py-10 text-foreground">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-3.5 rounded-[22px] bg-card shadow-card px-5 py-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="wifi_off" size={30} />
        </span>
        <h1 className="text-large-title font-bold tracking-tight leading-tight">No connection</h1>
        <p className="max-w-[34ch] text-body leading-normal text-muted-foreground">
          Your books live on the server, so they need a signal to open. Nothing has been lost.
          Open Add Entry once while online, and from then on entries can be written here
          without a signal and sent when it returns.
        </p>
        {queue.length > 0 && (
          <p className="text-subhead text-muted-foreground">
            {queue.length === 1 ? 'One entry is' : `${queue.length} entries are`} waiting on this phone to be sent.
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={cn(quietBtn, 'mt-2')}>Try again</a>
      </div>
    </main>
  );
}
