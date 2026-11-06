'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../Icon';
import { Figure } from '../Figure';
import { defaultRef, findRef, flatWays, pickWay, type Way } from '@/lib/pay';
import Link from '@/app/NavLink';
import { friendlyDay } from '@/lib/recur';
import { useMoney } from '@/app/currency';
import { saveEntry, checkDuplicate, type Draft } from './actions';
import { startPending } from '../pending';
import { haptic } from '../haptics';
import { enqueue, writePickers, type Queued } from './queue';
import { type Category } from '../CategoryFinder';
import { type Staged } from './Bills';
import { fits } from '@/lib/scope';
import { cn } from '@/lib/utils';
import TopCategories from './TopCategories';
import MoreFields, { type MoreState } from './MoreFields';
import { InDrawer, PayRow, Row, ToRow, WhenRow } from './PickRows';
import { useKeyboardInset } from './keyboard';

/* Add Entry — the screen the whole product rests on, and now one screen.

   With no bank feed and no SMS, this is how nearly everything gets in, so the
   common entry is three taps: type the amount, tap one of the eight tiles,
   tap Save. Everything else already has an answer. How it was paid opens on
   the way this person last paid with; the day is Today; the rest — where, a
   remark, the bill, a tab, what money coming in clears, shared — sits folded
   under one row and opens itself when it starts to matter.

   The amount is a plain field that takes the phone's own keyboard and formats
   itself as it is typed, in the household's currency. Save sits pinned under
   the thumb and says what it will do — "Save · ₹2,340 Groceries" — and stays
   above the keyboard on an iPhone as well as on Android.

   A Move (a transfer between your own accounts) has nothing to be "for", so
   its tiles are replaced by From and To. The Draft sent to saveEntry is the
   same shape it always was, so entries queued on a phone by the old two-step
   screen still save. */

type Kind = 'expense' | 'income' | 'transfer';

const KINDS: { id: Kind; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Move' },
];

export type { Category };
export type { Way };
export type Tab = { id: string; name: string; people: number; last_counts: boolean | null };
/** An open claim, for the income screen to point money at. */
export type Claim = {
  id: string; person: string; tint: string; tab: string | null; what: string;
  on: string; outstanding: number;
};

export default function AddEntry({
  categories, ways, tabs = [], claims = [], today, householdId, draft, offline = false, onQueued, children, sheet = false,
  canScan = false, top, paidWith: paidDefault, lastPaid = null, fromSms = null,
}: {
  categories: Category[];
  /** Every real account, each with the rails that draw on it. See src/lib/pay.ts. */
  ways: Way[];
  tabs?: Tab[]; claims?: Claim[]; today: string;
  householdId: string;
  /** Opened as a drawer over another screen: Close steps back to it instead of going Home. */
  sheet?: boolean;
  /** The household has a scanning key and this person may add: show the camera. */
  canScan?: boolean;
  /** The tiles, most used first (topCategories). Absent offline, where the phone's counts stand in. */
  top?: { expense: string[]; income: string[] };
  /** The way to open on: the last one used if it still resolves, else the first way. */
  paidWith?: string;
  /** Set when paidWith IS the remembered last-used way, so the row can say so. */
  lastPaid?: string | null;
  /** Opened from a forwarded bank message: its id is the entry's client reference, so saving accepts it once. */
  fromSms?: { clientRef: string; sender: string | null } | null;
  draft?: {
    amountMinor: number | null; occurredOn: string | null; merchant: string | null;
    kind: Kind | null; categoryId: string | null; tabId?: string | null;
    tabCoveredMinor?: number | null; countsAsSpend?: boolean | null;
    /** A transfer arriving with its ends already known — a card bill, an account. */
    toAccountId?: string | null; fromAccountId?: string | null;
    /** How it was paid, already decided (money in from a bank message lands on the account itself). */
    paidWith?: string | null;
  };
  /* On the offline screen nothing is sent from here at all: every save goes
     to the phone's queue, and the layout sends the queue when signal is back. */
  offline?: boolean;
  onQueued?: (q: Queued) => void;
  /** Drawn under the questions — the offline screen's banner and pending list. */
  children?: React.ReactNode;
}) {
  const { currency, symbol, digits, format, keysDisplay, fromKeys, toKeys, typed, settle } = useMoney();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kept, setKept] = useState<string | null>(null);
  /* The bank message this entry is made from, until it has been saved or kept once: a second entry typed on the
     same screen afterwards is a different entry, and must not be mistaken for a retry of the first. */
  const smsRef = useRef(fromSms?.clientRef ?? null);

  /* Opened with signal, so remember what the pickers hold — names only, no
     amounts — for the offline screen to offer the same choices. */
  useEffect(() => {
    if (offline) return;
    writePickers({ householdId, categories, ways, tabs, top, paidWith: paidDefault, savedAt: new Date().toISOString() });
  }, [offline, householdId, categories, ways, tabs, top, paidDefault]);

  const [kind, setKind] = useState<Kind>(draft?.kind ?? 'expense');
  /* A scan's draft seeds the field rather than saving anything: a scanned
     figure is a suggestion, correctable the same way as a typed one. */
  const [keys, setKeys] = useState(() => (draft?.amountMinor ? settle(toKeys(draft.amountMinor)) : ''));
  const amountBox = useRef<HTMLInputElement>(null);
  const [typing, setTyping] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
  /* Only the categories that take this kind of entry. A category picked for
     one kind and then the kind changed is simply let go of. */
  const offered = kind === 'transfer' ? [] : categories.filter((c) => fits(c.scope, kind));
  const chosen = offered.find((c) => c.id === categoryId);

  /* How it was paid, as one reference. A draft naming the account it leaves
     (a swipe on Money) lands on that account's usual rail; otherwise the last
     way used, resolved on the server; otherwise the first way. */
  const [paid, setPaid] = useState(() => {
    if (draft?.paidWith && findRef(ways, draft.paidWith)) return draft.paidWith;
    const from = ways.find((w) => w.id === draft?.fromAccountId);
    if (from) return pickWay(from);
    /* The remembered way is how this person PAYS, so it opens an expense only.
       Money coming in and a move start where they always did: the first way. */
    let ref = (draft?.kind ?? 'expense') === 'expense' && paidDefault && findRef(ways, paidDefault)
      ? paidDefault : defaultRef(ways);
    /* A move arriving with its destination (a card's Pay, an account's Move)
       can never start from that same account, or To would not resolve and
       Save would never light. Take the first way that leaves another. */
    const into = draft?.toAccountId;
    if (into && findRef(ways, ref)?.way.id === into) {
      ref = flatWays(ways).find((o) => o.way.id !== into)?.ref ?? ref;
    }
    return ref;
  });
  const [counterId, setCounterId] = useState<string | null>(draft?.toAccountId ?? null);
  const [occurredOn, setOccurredOn] = useState(draft?.occurredOn ?? today);
  const [more, setMoreState] = useState<MoreState>(() => ({
    merchant: draft?.merchant ?? '', note: '', bills: [] as Staged[], tabId: draft?.tabId ?? null, coveredKeys: '',
    counts: draft?.countsAsSpend ?? null, settleIds: new Set<string>(), shared: true,
  }));
  const setMore = <K extends keyof MoreState>(k: K, v: MoreState[K]) => setMoreState((s) => ({ ...s, [k]: v }));
  const [error, setError] = useState<string | null>(null);
  const [dupe, setDupe] = useState<{
    minor: number; on: string; hit: Awaited<ReturnType<typeof checkDuplicate>>;
  } | null>(null);

  const minor = fromKeys(keys);
  const paying = findRef(ways, paid);
  const fromWay = paying?.way;
  const tab = kind === 'transfer' ? null : tabs.find((t) => t.id === more.tabId) ?? null;
  const mine = more.counts ?? tab?.last_counts ?? true;
  const exact = kind === 'income' && minor > 0 && claims.some((c) => c.outstanding === minor);
  const settling = kind === 'income' ? claims.filter((c) => more.settleIds.has(c.id)) : [];
  const owedBack = settling.reduce((n, c) => n + c.outstanding, 0);
  /* All of it is money back, so none of it needs a category. */
  const allBack = settling.length > 0 && minor > 0 && minor <= owedBack;

  /* "More" opens by itself when one of its questions starts to matter: a tab
     on an expense (what it means for the budget), or money arriving that is
     exactly what somebody owes. Opened on the change, not held open, so it
     can still be folded away again. */
  const wantMore = (kind === 'expense' && tab !== null) || exact;
  const [moreOpen, setMoreOpen] = useState(wantMore);
  const [wanted, setWanted] = useState(wantMore);
  if (wantMore !== wanted) { setWanted(wantMore); if (wantMore) setMoreOpen(true); }

  /* Prevention beats detection: ask what is already recorded while they are
     still typing, so the warning arrives at the moment of the decision. */
  useEffect(() => {
    if (minor <= 0 || offline) return;
    const t = setTimeout(() => {
      checkDuplicate(minor, occurredOn)
        .then((hit) => setDupe({ minor, on: occurredOn, hit }))
        .catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [minor, occurredOn, offline]);
  const shownDupe = dupe && dupe.minor === minor && dupe.on === occurredOn ? dupe.hit : null;

  const to = kind === 'transfer' ? ways.find((w) => w.id === counterId && w.id !== fromWay?.id) : undefined;
  const canSave = minor > 0 && !pending && paying !== null && (
    kind === 'transfer' ? to !== undefined : chosen !== undefined || allBack);

  const chooseKind = (k: Kind) => {
    haptic('select');
    setKind(k);
    if (k === 'transfer') setCategoryId(null);
  };

  function save() {
    if (!canSave) return;
    setError(null);
    setKept(null);
    const d: Draft = {
      kind, amountMinor: minor, categoryId: chosen?.id ?? null, paidWith: paid,
      counterAccountId: kind === 'transfer' ? to?.id ?? null : null,
      merchant: more.merchant, note: more.note, occurredOn, isShared: more.shared,
      attachments: more.bills.map((b) => ({ name: b.name, mime: b.mime, data: b.data })),
      tabId: kind === 'transfer' ? null : more.tabId,
      tabCoveredMinor: kind === 'expense' && more.tabId && more.coveredKeys ? fromKeys(more.coveredKeys) : null,
      countsAsSpend: kind === 'expense' && more.tabId ? mine : null,
      settles: settling.map((c) => c.id),
      ...(smsRef.current ? { clientRef: smsRef.current, draftId: smsRef.current } : {}),
    };
    const clear = () => {
      setKeys(''); setCategoryId(null); setDupe(null);
      setMoreState((s) => ({ ...s, merchant: '', note: '', bills: [], settleIds: new Set() }));
    };
    /* Kept on the phone: from where the thumb is it IS a save — the entry
       exists and will not be lost. Bills do not go in the queue (a photo is a
       megabyte, and localStorage is a few for the whole origin), and the
       message says so rather than letting anyone believe one is on its way. */
    const keep = () => {
      const q = enqueue({ ...d, attachments: null }, householdId);
      smsRef.current = null;
      haptic('success');
      const n = more.bills.length;
      clear();
      setKept(n > 0
        ? `${format(q.amountMinor)} kept on this phone — but not the ${n === 1 ? 'bill' : 'bills'}. Attach ${n === 1 ? 'it' : 'them'} from the entry once there is signal.`
        : `${format(q.amountMinor)} kept on this phone. It goes into the books the moment there is signal.`);
      onQueued?.(q);
    };
    if (offline || !navigator.onLine) { keep(); return; }
    start(async () => {
      let r;
      try { r = await saveEntry(d); }
      catch { keep(); return; }  // the request itself failed: no signal, or it dropped mid-way
      if (r.ok) {
        haptic('success'); clear(); smsRef.current = null;
        /* A cost put on a tab lands on that tab, opening "Attach the bill?"
           when none came with it, because the paper is in hand right now. */
        if (d.tabId) {
          const bill = d.kind === 'expense' && (d.attachments?.length ?? 0) === 0 ? `?saved=${r.id}` : '';
          startPending(`/tab/${d.tabId}`);
          router.push(`/tab/${d.tabId}${bill}`, { transitionTypes: ['nav-forward'] });
        } else { startPending('/'); router.push(`/?saved=${r.id}`); }
      }
      else { haptic('warn'); setError(r.error); }
    });
  }

  /* The keyboard covers the bottom of the page on an iPhone; the drawer is
     resized for it by vaul, so only the full page needs lifting. */
  const kb = useKeyboardInset(!sheet);

  const what = kind === 'transfer'
    ? (to ? `to ${to.name}` : '')
    : allBack ? 'money back' : chosen?.name ?? '';
  const moreSummary = [
    tab?.name, settling.length ? `clears ${settling.length}` : null, more.merchant || null,
    more.note ? 'remark' : null, more.bills.length ? `${more.bills.length} bill${more.bills.length > 1 ? 's' : ''}` : null,
    more.shared ? null : 'not shared',
  ].filter(Boolean).join(' · ');
  const moreLabel = kind === 'income' && claims.length > 0 ? 'What it clears, note, bill, tab…' : 'Note, bill, tab, shared…';

  return (
    <InDrawer.Provider value={sheet}>
    <main className={cn('flex flex-col bg-background text-foreground', !sheet && 'min-h-dvh')}>
      <header className="flex flex-none flex-col gap-1 px-[var(--gutter)] pt-2">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Close"
            className="-ml-2.5 flex size-11 items-center justify-center rounded-full in-data-[platform=android]:size-12"
            onClick={() => { haptic('select'); if (sheet) router.back(); else router.push('/', { transitionTypes: ['nav-back'] }); }}>
            <Icon name="close" size={24} />
          </button>
          <div role="tablist" aria-label="Kind of entry" className="flex rounded-xl bg-muted p-[3px]">
            {KINDS.map((k) => {
              const isOn = k.id === kind;
              return (
                <button key={k.id} type="button" role="tab" aria-selected={isOn} onClick={() => chooseKind(k.id)}
                  className={cn('min-h-11 rounded-[10px] px-3.5 text-sm transition-colors',
                    isOn ? 'bg-raised font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground')}>
                  {k.label}
                </button>
              );
            })}
          </div>
          {!offline && canScan ? (
            <Link href="/scan" transitionTypes={['nav-forward']} aria-label="Scan or upload a receipt"
              className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-foreground in-data-[platform=android]:size-12">
              <Icon name="photo_camera" size={22} />
            </Link>
          ) : (
            <span aria-hidden className="-mr-2.5 size-11 in-data-[platform=android]:size-12" />
          )}
        </div>

        {fromSms && (
          <p className="flex min-h-8 items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Icon name="sms" size={16} /> From a bank message{fromSms.sender ? ` · ${fromSms.sender}` : ''}
          </p>
        )}

        {/* The amount, as a plain field the phone's keyboard fills. What it
            shows is grouped in the household's currency; what it holds is
            only ever the digits typed. */}
        <label className="flex min-w-0 items-baseline justify-center gap-1.5 py-2">
          <span aria-hidden className="n flex-none text-[28px] font-medium text-muted-foreground">{symbol.trim()}</span>
          <input
            ref={amountBox}
            size={Math.max(4, (keys === '' ? (digits ? digits + 2 : 1) : keysDisplay(keys).length) + 1)}
            className="n w-auto max-w-[78%] min-w-0 flex-initial [field-sizing:content] bg-transparent p-0 text-[52px] leading-tight font-bold tracking-tight text-foreground caret-primary outline-none placeholder:text-muted-foreground/50"
            type="text" inputMode="decimal" autoComplete="off" enterKeyHint="done"
            autoFocus={!draft?.amountMinor}
            value={keys === '' ? '' : keysDisplay(keys)}
            onChange={(e) => { setKept(null); setKeys(typed(e.target.value)); }}
            onFocus={() => setTyping(true)}
            onBlur={() => { setTyping(false); setKeys((k) => settle(k)); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); amountBox.current?.blur(); } }}
            placeholder={digits ? `0.${'0'.repeat(digits)}` : '0'}
            aria-label={`Amount in ${currency}`}
          />
          {/* The code, for a symbol that does not spell it: ₹ says INR to one
              household and nothing to a guest. AED already says AED. */}
          {symbol.trim() !== currency && (
            <span className="n flex-none text-sm font-semibold text-muted-foreground">{currency}</span>
          )}
        </label>
        {/* The amount as the ledger will write it, digits rolling as they are
            typed — only while it is being typed, since a settled field already
            says exactly this. Decoration only: the field is the control. */}
        <p aria-hidden data-figure-echo className="-mt-1 mb-1 min-h-5 text-center text-sm text-muted-foreground">
          {minor > 0 && (typing || keys !== settle(keys)) && <Figure minor={minor} paise="auto" className="n" />}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-[var(--gutter)] pt-2 pb-4">
        {kind !== 'transfer' && (
          <section aria-labelledby="add-category" className="flex flex-col gap-2">
            <span id="add-category" className="text-xs font-semibold text-muted-foreground">
              {kind === 'income' ? 'What for · your most used' : 'Category · your most used'}
              {allBack && ' · not needed, all of it is money back'}
            </span>
            <TopCategories categories={offered} top={top?.[kind]} value={categoryId}
              onChange={setCategoryId} label={kind === 'income' ? 'What the money was for' : 'Which category'} />
          </section>
        )}

        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <PayRow ways={ways} value={paid} onChange={(ref) => {
            setPaid(ref);
            if (findRef(ways, ref)?.way.id === counterId) setCounterId(null);
          }}
            caption={kind === 'transfer' ? 'From' : kind === 'income' ? 'Came into' : 'Paid with'}
            title={kind === 'transfer' ? 'From which account' : kind === 'income' ? 'How did it come in' : 'How did you pay'}
            tag={kind === 'expense' && lastPaid && paid === lastPaid ? 'last used' : undefined} />
          {kind === 'transfer' && (
            <ToRow ways={ways} from={fromWay?.id} value={to?.id ?? null} onChange={setCounterId} />
          )}
          <WhenRow value={occurredOn} onChange={setOccurredOn} today={today} />
          {kind !== 'transfer' && (
            <Row id="add-more" icon={<Icon name="tune" size={22} />} muted={!moreSummary}
              value={moreSummary || moreLabel} expanded={moreOpen} controls="add-more-fields"
              onClick={() => setMoreOpen((o) => !o)} />
          )}
        </div>

        {kind !== 'transfer' && moreOpen && (
          <div id="add-more-fields" role="region" aria-labelledby="add-more">
            <MoreFields kind={kind} state={more} set={setMore} tabs={tabs} claims={claims} minor={minor}
              today={today} canScan={canScan} offline={offline}
              onUseOwed={(n) => setKeys(settle(toKeys(n)))} />
          </div>
        )}

        {children && <div className="-mx-[var(--gutter)]">{children}</div>}
      </div>

      {/* Save, pinned under the thumb and saying what it will do, with what
          was kept, a refusal and the duplicate line above it, so none of them
          can be scrolled out of sight. On an iPhone it is lifted by however much of
          the page the keyboard covers. */}
      <div style={{ '--kb': `${kb}px` } as React.CSSProperties}
        className="sticky bottom-[var(--kb)] z-10 flex-none border-t border-border bg-background px-[var(--gutter)] pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
        {kept && (
          <p role="status" className="m-0 mb-2 flex items-center gap-2.5 rounded-xl bg-accent px-3.5 py-3 text-sm leading-snug font-semibold text-accent-foreground">
            <Icon name="schedule" size={18} />{kept}
          </p>
        )}

        {error && (
          <p role="alert" className="m-0 mb-2 flex items-center gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold text-destructive">
            <Icon name="error" size={18} />{error}
          </p>
        )}
        {/* What a household member already recorded that this might be: one quiet line at the moment of the
            decision, right above the button that makes it. */}
        {shownDupe && (
          <p role="status" data-duplicate className="m-0 mb-2 flex items-start gap-2 rounded-xl bg-attention-soft px-3 py-2.5 text-sm leading-snug text-attention-soft-foreground">
            <Icon name="info" size={18} />
            <span className="flex-1">
              <b>{shownDupe.who}</b> already recorded {format(shownDupe.amountMinor)}
              {shownDupe.merchant ? ` at ${shownDupe.merchant}` : ''} {onDay(shownDupe.on, today)}, from {shownDupe.account}.
              {' '}Same purchase?
            </span>
          </p>
        )}
        <button type="button" onClick={save} disabled={!canSave} data-save
          className="flex h-14 w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-45">
          {pending ? 'Saving…' : (
            <>
              <span className="flex-none">Save</span>
              {minor > 0 && <>
                {' '}<span aria-hidden className="flex-none">·</span>{' '}
                <Figure minor={minor} paise="auto" className="n flex-none" />
                {what && <>{' '}<span className="min-w-0 truncate">{what}</span></>}
              </>}
            </>
          )}
        </button>
      </div>
    </main>
    </InDrawer.Provider>
  );
}

/** "today", "yesterday", "on Sun 6 Sep" — a day inside a sentence. */
function onDay(iso: string, today: string) {
  const d = friendlyDay(iso, today);
  return d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : `on ${d}`;
}
