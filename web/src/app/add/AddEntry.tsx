'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Icon, tintOf } from '../Icon';
import { defaultRef, findRef, payLabel, pickWay, type Way } from '@/lib/pay';
import PayPicker, { CHIP, CHIP_TEXT, TILE_GRID, WayTile, describe } from '../PayPicker';
import { HEADER_BG } from '../auth-ui';
import { useRouter } from 'next/navigation';
import { DateChips } from '../DatePick';
import { friendlyDay } from '@/lib/recur';
import { useMoney } from '@/app/currency';
import { saveEntry, checkDuplicate } from './actions';
import { haptic } from '../haptics';
import { enqueue, writePickers, type Queued } from './queue';
import { shares } from '../tab/splits';
import { type Category } from '../CategoryFinder';
import CategoryGrid from './CategoryGrid';
import { fits } from '@/lib/scope';
import { OFF, on, choice } from '../choice';

/* Add Entry — the screen the whole product rests on.
   With no bank feed and no SMS, this is how nearly everything gets in, so it
   is built for the fewest decisions per page: two pages, each asking only
   what it must.

   Page one is the money: how much, paid with what, and which day. The
   amount is a plain field that takes the phone's own keyboard — the drawn-in
   keypad is gone — and it formats itself as you type, in the household's
   currency, so ₹2,340.50 is what you see and not 2340.5. Page two is what it
   was for: the category and, within it, the sub-category, then the small
   questions — where, whether it went on a tab, whether it clears something
   owed. A transfer has nothing to be "for", so it is one page.

   Every choice on both pages is grey until it is the answer, and only the
   answer wears colour. That is the whole of the selection language: no
   confirmation text beside a section name, no chips in eight competing
   tints. The next thing to do is always the one button at the bottom. */

type Kind = 'expense' | 'income' | 'transfer';

const KINDS: { id: Kind; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
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
  categories, ways, tabs = [], claims = [], today, householdId, draft, offline = false, onQueued, children,
}: {
  categories: Category[];
  /** Every real account, each with the rails that draw on it. See src/lib/pay.ts. */
  ways: Way[];
  tabs?: Tab[]; claims?: Claim[]; today: string;
  householdId: string;
  draft?: {
    amountMinor: number | null; occurredOn: string | null; merchant: string | null;
    kind: Kind | null; categoryId: string | null; tabId?: string | null;
    tabCoveredMinor?: number | null; countsAsSpend?: boolean | null;
    /** A transfer arriving with its ends already known — a card bill, an account. */
    toAccountId?: string | null; fromAccountId?: string | null;
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

  /* Opened with signal, so remember what the pickers hold. This is what lets
     the offline screen offer the same categories and ways of paying — names
     only, no amounts, no entries — and it is replaced on every visit. */
  useEffect(() => {
    if (offline) return;
    writePickers({ householdId, categories, ways, tabs, savedAt: new Date().toISOString() });
  }, [offline, householdId, categories, ways, tabs]);

  const [step, setStep] = useState<1 | 2>(1);
  /* A scan hands its draft over here rather than saving anything itself. The
     field is seeded with the amount so it stays the same control, correctable
     the same way — a scanned figure is a suggestion, not a fact. */
  const [kind, setKind] = useState<Kind>(draft?.kind ?? 'expense');
  const [keys, setKeys] = useState(() => (draft?.amountMinor ? settle(toKeys(draft.amountMinor)) : ''));
  const amountBox = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
  /* Only the categories that take this kind of entry: income under Salary,
     not under Groceries. The server refuses the other way round, so a tile
     that would be refused is not offered. A category picked for one kind
     and then the kind changed is simply let go of. */
  const offered = categories.filter((c) => fits(c.scope, kind ?? 'expense'));
  const chosen = offered.find((c) => c.id === categoryId);
  const [tabId, setTabId] = useState<string | null>(draft?.tabId ?? null);
  /* Blank means all of it comes back, which is the ordinary case. A figure
     here is the part that does, leaving the rest owed by nobody. */
  const [coveredKeys, setCoveredKeys] = useState('');
  /* Asked of every cost on a tab. Null is "not answered yet", which follows
     whatever the last cost on that tab said — petrol on the office tab is
     petrol every week — and is your own spending on a tab with no history. */
  const [counts, setCounts] = useState<boolean | null>(draft?.countsAsSpend ?? null);
  /* What this money clears, when it is money coming back. The claims are
     never on the offline screen — they are amounts, and the phone keeps only
     names — so a settlement waits for signal. */
  const [settleIds, setSettleIds] = useState<Set<string>>(() => new Set());
  /* How it was paid, as one reference: an account, or a rail on one. A draft
     that names the account it leaves — a swipe on the accounts screen —
     lands on that account's usual rail. */
  const [paid, setPaid] = useState(() => {
    const from = ways.find((w) => w.id === draft?.fromAccountId);
    return from ? pickWay(from) : defaultRef(ways);
  });
  const [counterId, setCounterId] = useState<string | null>(draft?.toAccountId ?? null);
  const [shared, setShared] = useState(true);
  const [occurredOn, setOccurredOn] = useState(draft?.occurredOn ?? today);
  const [merchant, setMerchant] = useState(draft?.merchant ?? '');
  const [error, setError] = useState<string | null>(null);
  /* Kept with the amount and date it was asked about, so a stale answer is
     never shown against a figure that has since changed. */
  const [dupe, setDupe] = useState<{
    minor: number; on: string; hit: Awaited<ReturnType<typeof checkDuplicate>>;
  } | null>(null);

  const minor = fromKeys(keys);
  const paying = findRef(ways, paid);
  const way = paying?.way ?? ways[0];
  const tab = tabs.find((t) => t.id === tabId) ?? null;
  const mine = counts ?? tab?.last_counts ?? true;
  const settling = kind === 'income' ? claims.filter((c) => settleIds.has(c.id)) : [];
  const owedBack = settling.reduce((n, c) => n + c.outstanding, 0);
  /* All of it is money back, so none of it needs a category. */
  const allBack = settling.length > 0 && minor > 0 && minor <= owedBack;

  /* Prevention beats detection: ask what is already recorded while they are
     still typing, so the warning arrives at the moment of the decision rather
     than as cleanup in the Inbox later. Debounced, because every keypress
     would otherwise be a round trip. */
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

  // A transfer moves money and can never wear a category — the same rule the
  // database enforces, applied here so the page simply is not offered.
  const wantsCategory = kind !== 'transfer';
  const canNext = minor > 0;
  const canSave = minor > 0 && (!wantsCategory || chosen !== undefined || allBack)
    && (kind !== 'transfer' || counterId !== null) && !pending;

  const go = (to: 1 | 2) => {
    haptic('select');
    setStep(to);
    window.scrollTo({ top: 0 });
  };
  const chooseKind = (k: Kind) => {
    setKind(k);
    if (k === 'transfer') { setCategoryId(null); setStep(1); }
  };

  function save() {
    setError(null);
    setKept(null);
    const draft = {
      kind, amountMinor: minor, categoryId: chosen?.id ?? null, paidWith: paid,
      counterAccountId: counterId, merchant, occurredOn, isShared: shared,
      tabId: kind === 'expense' ? tabId : null,
      tabCoveredMinor: kind === 'expense' && tabId && coveredKeys ? fromKeys(coveredKeys) : null,
      countsAsSpend: kind === 'expense' && tabId ? mine : null,
      settles: settling.map((c) => c.id),
    };
    const clear = () => { setKeys(''); setCategoryId(null); setMerchant(''); setDupe(null); setStep(1); };
    /* Kept on the phone: the same tick as a save, because from where the
       thumb is it IS a save — the entry exists and will not be lost. The
       words underneath say where it is. */
    const keep = () => {
      const q = enqueue(draft, householdId);
      haptic('success');
      clear();
      setKept(`${format(q.amountMinor)} kept on this phone. It goes into the books the moment there is signal.`);
      onQueued?.(q);
    };
    if (offline || !navigator.onLine) { keep(); return; }
    start(async () => {
      let r;
      try { r = await saveEntry(draft); }
      catch { keep(); return; }  // the request itself failed: no signal, or it dropped mid-way
      if (r.ok) { haptic('success'); clear(); router.push('/'); }
      else { haptic('warn'); setError(r.error); }
    });
  }

  const kindLabel = KINDS.find((k) => k.id === kind)?.label ?? '';
  const summary = [
    format(minor, { paise: true }),
    kindLabel,
    paying ? payLabel(paying.way, paying.rail) : null,
    friendlyDay(occurredOn, today),
  ].filter(Boolean).join(' · ');

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      <header
        className="el2"
        style={{
          flex: 'none', background: HEADER_BG, color: '#fff',
          borderRadius: '0 0 22px 22px', padding: '8px var(--gutter) 16px',
          display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {step === 1 ? (
            <button aria-label="Close" style={iconBtn}
              onClick={() => { haptic('select'); router.push('/', { transitionTypes: ['nav-back'] }); }}>
              <Glyph d="M6 6l12 12M18 6L6 18" />
            </button>
          ) : (
            <button aria-label="Back to the amount" style={iconBtn} onClick={() => go(1)}>
              <Glyph d="M15 5l-7 7 7 7" />
            </button>
          )}
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-2)' }}>
            {step === 1 ? 'New entry' : kind === 'income' ? 'What for' : 'Category'}
          </h1>
          {step === 1 && !offline ? (
            <a href="/scan" aria-label="Scan a receipt" style={{
              width: 44, height: 44, borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
            }}>
              <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 8.5 6 6h4l1-1.5h2L14 6h4l1.5 2.5v9a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" />
                <circle cx="12" cy="12.5" r="3.4" />
              </svg>
            </a>
          ) : (
            <span aria-hidden style={{ width: 44, height: 44 }} />
          )}
        </div>

        {step === 1 ? (
          <>
            <div role="tablist" aria-label="Kind of entry" style={{ display: 'flex', gap: 3, padding: 3, background: 'rgba(0,0,0,.22)', borderRadius: 999 }}>
              {KINDS.map((k) => {
                const isOn = k.id === kind;
                return (
                  <button
                    key={k.id}
                    role="tab"
                    aria-selected={isOn}
                    onClick={() => { haptic('select'); chooseKind(k.id); }}
                    style={{
                      flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600,
                      background: isOn ? '#fff' : 'transparent',
                      color: isOn ? '#233D4D' : 'rgba(255,255,255,.72)',
                    }}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>

            {/* The amount, as a plain field the phone's keyboard fills. What it
                shows is the accounting form — grouped, in the household's
                currency, the minor digits completed when the field is left —
                and what it holds is only ever the digits typed. */}
            <label style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              <span className="n" aria-hidden style={{ fontSize: 'var(--step-3)', fontWeight: 500, color: 'rgba(255,255,255,.62)', flex: 'none' }}>
                {symbol.trim()}
              </span>
              <input
                ref={amountBox}
                className="n"
                type="text" inputMode="decimal" autoComplete="off" enterKeyHint={wantsCategory ? 'next' : 'done'}
                autoFocus={!draft?.amountMinor}
                value={keys === '' ? '' : keysDisplay(keys)}
                onChange={(e) => setKeys(typed(e.target.value))}
                onBlur={() => setKeys((k) => settle(k))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  amountBox.current?.blur();
                  if (wantsCategory && canNext) go(2);
                }}
                placeholder={digits ? `0.${'0'.repeat(digits)}` : '0'}
                aria-label={`Amount in ${currency}`}
                style={{
                  flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 0, padding: 0,
                  color: '#fff', caretColor: '#fff', fontSize: 'var(--step-4)', fontWeight: 600,
                  letterSpacing: '-.036em', lineHeight: 1.15, outline: 'none',
                }}
              />
              {/* The code, for a symbol that does not spell it: ₹ says INR to
                  one household and nothing to a guest. AED already says AED. */}
              {symbol.trim() !== currency && (
                <span className="n" style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'rgba(255,255,255,.55)', flex: 'none' }}>
                  {currency}
                </span>
              )}
            </label>
          </>
        ) : (
          <button type="button" onClick={() => go(1)} style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '8px 12px',
            borderRadius: 12, background: 'rgba(0,0,0,.22)', color: 'rgba(255,255,255,.92)',
            fontSize: 'var(--step--1)', fontWeight: 600, minWidth: 0, lineHeight: 1.35,
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>{summary}</span>
            <span style={{ flex: 'none', color: 'rgba(255,255,255,.62)', fontWeight: 600, fontSize: 'var(--step--2)' }}>Change</span>
          </button>
        )}
      </header>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 20,
        padding: '18px var(--gutter) 16px',
      }}>

      {step === 1 && (
        <>
          {/* One question, asked the way a person would: every concrete way
              to pay as a tile, and one tap settles both the account and the
              rail. */}
          <section aria-labelledby="add-paid" style={SECTION}>
            <Eyebrow id="add-paid">
              {kind === 'transfer' ? 'From which account' : kind === 'income' ? 'How did it come in' : 'How did you pay'}
            </Eyebrow>
            <PayPicker ways={ways} value={paid} onChange={setPaid} />
          </section>

          {/* Where a transfer lands, on the same terms: every account visible. */}
          {kind === 'transfer' && (
            <section aria-labelledby="add-into" style={SECTION}>
              <Eyebrow id="add-into">To which account</Eyebrow>
              <div role="radiogroup" aria-label="To which account" style={TILE_GRID}>
                {ways.filter((a) => a.id !== way?.id).map((a) => {
                  const d = describe({ ref: '', way: a, rail: null });
                  return (
                    <WayTile key={a.id} {...d} on={a.id === counterId}
                      onClick={() => { haptic('select'); setCounterId(a.id); }} />
                  );
                })}
              </div>
            </section>
          )}

          {/* Which day: today, yesterday, and any other day one tap further,
              on a grid. Never a day ahead. */}
          <section aria-labelledby="add-when" style={SECTION}>
            <Eyebrow id="add-when">When</Eyebrow>
            <DateChips value={occurredOn} onChange={setOccurredOn} today={today} dir="past" max={today}
              count={2} label="Which day was it" />
          </section>
        </>
      )}

      {step === 2 && (
        <>
          {kind === 'income' && claims.length > 0 && (
            <section aria-labelledby="add-claims" style={SECTION}>
              <Eyebrow id="add-claims">Clears what is owed</Eyebrow>
              <div role="group" aria-label="Which entries this money clears" style={{
                display: 'flex', flexDirection: 'column', borderRadius: 14,
                background: 'var(--c-card)', border: '1px solid var(--c-border)', overflow: 'hidden',
              }}>
                {claims.map((c, i) => {
                  const isOn = settleIds.has(c.id);
                  const [bg, ink] = tintOf(c.tint);
                  return (
                    <button key={c.id} type="button" aria-pressed={isOn}
                      onClick={() => {
                        haptic('select');
                        setSettleIds((s) => { const n = new Set(s); if (isOn) n.delete(c.id); else n.add(c.id); return n; });
                      }}
                      style={{
                        minHeight: 54, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 11,
                        textAlign: 'left', background: isOn ? 'var(--c-teal-l)' : 'transparent',
                        color: isOn ? 'var(--c-ink)' : 'var(--c-meta)',
                        borderTop: i === 0 ? undefined : '1px solid var(--c-rule)',
                      }}>
                      <span aria-hidden style={{
                        width: 22, height: 22, flex: 'none', borderRadius: 7, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: isOn ? 'var(--c-primary-hi)' : 'var(--c-sunk)',
                        border: `1px solid ${isOn ? 'var(--c-primary-hi)' : 'var(--c-border)'}`,
                        color: 'var(--c-on-primary)',
                      }}>
                        {isOn && <Icon name="check" size={15} strokeWidth={2.6} />}
                      </span>
                      <span style={{
                        width: 30, height: 30, flex: 'none', borderRadius: 999, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--2)',
                        fontWeight: 700, background: isOn ? bg : 'var(--c-sunk)', color: isOn ? ink : 'var(--c-meta)',
                      }}>{c.person.slice(0, 2).toUpperCase()}</span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, ...CHIP_TEXT }}>{c.person} · {c.what}</span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                          {friendlyDay(c.on, today)}{c.tab ? ` · ${c.tab}` : ''}
                        </span>
                      </span>
                      <span className="t" style={{ fontSize: 'var(--step--1)', color: isOn ? 'var(--c-in)' : 'var(--c-meta)' }}>
                        {format(c.outstanding)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {settling.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p style={{ flex: 1, margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
                    {minor <= owedBack
                      ? `All ${format(minor)} is money back${minor < owedBack ? `, oldest first — ${format(owedBack - minor)} stays owed` : ''}. No category needed.`
                      : `${format(owedBack)} is money back · ${format(minor - owedBack)} is income and needs a category.`}
                  </p>
                  {minor !== owedBack && (
                    <button type="button" className="cta"
                      onClick={() => { haptic('select'); setKeys(settle(toKeys(owedBack))); }}
                      style={{
                        minHeight: 40, padding: '0 12px', borderRadius: 999, flex: 'none',
                        fontSize: 'var(--step--2)', fontWeight: 600, ...on('var(--c-primary-hi)'),
                      }}>Use {format(owedBack)}</button>
                  )}
                </div>
              )}
            </section>
          )}

          {!allBack && (
            <section aria-labelledby="add-category" style={SECTION}>
              <Eyebrow id="add-category">{kind === 'income' ? 'What for' : 'Category'}</Eyebrow>
              <CategoryGrid categories={offered} value={categoryId} onChange={setCategoryId}
                label={kind === 'income' ? 'What the money was for' : 'Which category'} />
            </section>
          )}

          <section style={SECTION}>
            <Eyebrow id="add-where">{kind === 'income' ? 'From whom' : 'Where'}</Eyebrow>
            <input
              value={merchant} onChange={(e) => setMerchant(e.target.value.slice(0, 60))}
              aria-labelledby="add-where" autoComplete="off"
              placeholder={kind === 'income' ? 'Who paid it (optional)' : 'The shop or place (optional)'} maxLength={60}
              style={{
                width: '100%', minHeight: 48, borderRadius: 13, padding: '0 14px',
                border: '1px solid var(--c-border)', background: 'var(--c-card)',
                color: 'var(--c-ink)', fontSize: 'var(--field)',
              }}
            />
          </section>

          {kind === 'expense' && tabs.length > 0 && (
            <section aria-labelledby="add-tab" style={SECTION}>
              <Eyebrow id="add-tab">On a tab</Eyebrow>
              <div role="group" aria-label="Which tab" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tabs.map((t) => {
                  const isOn = t.id === tabId;
                  return (
                    <button
                      key={t.id} type="button" aria-pressed={isOn}
                      onClick={() => { haptic('select'); setTabId(isOn ? null : t.id); }}
                      style={{ ...CHIP, ...choice(isOn, 'var(--cat-purple-ink)') }}
                    >
                      <Icon name="tab" size={16} strokeWidth={1.9} />
                      <span style={CHIP_TEXT}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
              {tab && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)' }}>
                      Comes back
                    </span>
                    <input
                      value={coveredKeys === '' ? '' : keysDisplay(coveredKeys)}
                      onChange={(e) => setCoveredKeys(typed(e.target.value))}
                      onBlur={() => setCoveredKeys((k) => settle(k))}
                      type="text" inputMode="decimal" autoComplete="off"
                      placeholder={minor > 0 ? `all of it — ${format(minor)}` : 'all of it'}
                      aria-label="How much of this comes back"
                      className="n"
                      style={{
                        flex: 1, minWidth: 0, minHeight: 40, padding: '0 12px', borderRadius: 11,
                        background: 'var(--c-card)', border: '1px solid var(--c-border)',
                        color: 'var(--c-ink)', fontSize: 'var(--field)',
                      }}
                    />
                  </label>
                  {/* Two answers, both on screen, because a tab carries both
                      kinds: the petrol you burned and are paid back for, and
                      the ticket you fronted that was never yours. */}
                  <div role="group" aria-label="Was this your spending?" style={{ display: 'flex', gap: 8 }}>
                    {([
                      [true, 'receivable', 'Mine, paid back', 'In the month and the charts'],
                      [false, 'person', 'Lent, not mine', 'Owed back, counted nowhere'],
                    ] as const).map(([v, icon, label, what]) => {
                      const isOn = mine === v;
                      return (
                        <button key={String(v)} type="button" aria-pressed={isOn}
                          onClick={() => { haptic('select'); setCounts(v); }}
                          style={{
                            flex: 1, minHeight: 56, padding: '8px 12px', borderRadius: 13, textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: 9,
                            ...choice(isOn, 'var(--cat-purple-ink)'),
                          }}>
                          <Icon name={icon} size={17} strokeWidth={1.9} />
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600 }}>{label}</span>
                            <span style={{ fontSize: 'var(--step--2)', opacity: isOn ? 0.82 : 0.8, lineHeight: 1.3 }}>{what}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
                    {tabNote(tab, minor, coveredKeys ? fromKeys(coveredKeys) : minor, mine, format)}
                  </p>
                </>
              )}
            </section>
          )}

          {/* A quiet row, not a card: it is the one question with a right
              answer nearly every time, so it should never outrank the ones
              above it. */}
          <button
            type="button" role="switch" aria-checked={shared}
            onClick={() => { haptic('select'); setShared((s) => !s); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 2px',
              borderTop: '1px solid var(--c-rule)', color: 'var(--c-ink)',
            }}
          >
            <span style={{ flex: 1, fontSize: 'var(--step--1)', fontWeight: 600 }}>Shared with the household</span>
            <span aria-hidden style={{
              width: 42, height: 26, borderRadius: 999, flex: 'none', padding: 3, display: 'flex',
              justifyContent: shared ? 'flex-end' : 'flex-start',
              background: shared ? 'var(--c-seagrass)' : 'var(--c-off)', transition: 'background .15s',
            }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: '#fff' }} />
            </span>
          </button>
        </>
      )}

      {shownDupe && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-pollen)', color: 'var(--c-on-fill)',
        }}>
          <Glyph d="M12 7.5v5.5 M12 16.6v.1 M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0" size={17} w={1.9} />
          <span style={{ flex: 1, fontSize: 'var(--step--1)', lineHeight: 1.45 }}>
            <b>{shownDupe.who}</b> already recorded {format(shownDupe.amountMinor)}
            {shownDupe.merchant ? ` at ${shownDupe.merchant}` : ''} {onDay(shownDupe.on, today)}, from {shownDupe.account}.
            Is this the same thing?
          </span>
        </div>
      )}

      {kept && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-teal-l)', color: 'var(--c-ink)',
          fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.4,
        }}>
          <Glyph d="M12 3a9 9 0 1 0 9 9 M12 8v4l3 2" size={17} w={2} />
          {kept}
        </div>
      )}

      {error && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
          fontSize: 'var(--step--1)', fontWeight: 600,
        }}>
          <Glyph d="M12 7.5v5.5 M12 16.6v.1 M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0" size={17} w={2} />
          {error}
        </div>
      )}

      {children && <div style={{ margin: '0 calc(-1 * var(--gutter))' }}>{children}</div>}
      </div>

      {/* The one thing to do next, pinned to the bottom: on to the category,
          or Save. It rides above the phone's keyboard where the phone allows
          (the viewport asks for that) and is a tap away otherwise. */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 2, flex: 'none',
        padding: '10px var(--gutter) calc(10px + env(safe-area-inset-bottom))', background: 'var(--c-card)',
        borderTop: '1px solid var(--c-border)', display: 'flex', gap: 10,
      }}>
        {step === 2 && (
          <button type="button" className="cta" onClick={() => go(1)} style={{
            ...BAR, flex: 'none', padding: '0 18px', ...OFF, color: 'var(--c-ink)',
          }}>
            <Glyph d="M15 5l-7 7 7 7" size={20} w={2.2} />
            Back
          </button>
        )}
        {step === 1 && wantsCategory ? (
          <button type="button" className="cta el2" onClick={() => go(2)} disabled={!canNext}
            style={{ ...BAR, ...PRIMARY, opacity: canNext ? 1 : 0.45 }}>
            Next
            <Glyph d="M9 5l7 7-7 7" size={20} w={2.2} />
          </button>
        ) : (
          <button type="button" className="cta el2" onClick={save} disabled={!canSave}
            style={{ ...BAR, ...PRIMARY, opacity: canSave ? 1 : 0.45 }}>
            <Glyph d="M5 12.5 10 17.5 19 7" size={22} w={2.2} />
            {pending ? 'Saving…' : minor > 0 ? `Save ${format(minor, { paise: true })}` : 'Save'}
          </button>
        )}
      </div>
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  width: 44, height: 44, marginLeft: -10, borderRadius: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.86)',
};
const SECTION: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 9 };
const BAR: React.CSSProperties = {
  flex: 1, minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
};
const PRIMARY: React.CSSProperties = {
  color: '#fff',
  background:
    'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),' +
    'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
};

/** The name of a question, in small capitals. Nothing else on the line: the
 *  answer is the one coloured thing in the section beneath it. */
function Eyebrow({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} style={{
      fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
      color: 'var(--c-meta)',
    }}>{children}</span>
  );
}

/** "today", "yesterday", "on Sun 6 Sep" — a day inside a sentence. */
function onDay(iso: string, today: string) {
  const d = friendlyDay(iso, today);
  return d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : `on ${d}`;
}

function Glyph({ d, size = 21, w = 2, colour }: { d: string; size?: number; w?: number; colour?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour ?? 'currentColor'}
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden>
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
    </svg>
  );
}

/** What putting this amount on the tab will do, in one line, before Save. */
function tabNote(tab: Tab, minor: number, covered: number, counts: boolean, format: (n: number) => string): string {
  const who = `${tab.people} ${tab.people === 1 ? 'person' : 'people'}`;
  const mine = counts ? 'Counts as your spending' : 'Not your spending';
  if (minor <= 0) {
    return tab.people === 1
      ? `${mine} · they owe all of it back.`
      : `${mine} · owed back, divided equally among ${who}.`;
  }
  if (covered > minor) return 'That is more than the amount itself.';
  const each = shares(covered, tab.people);
  const top = each.length ? Math.max(...each) : 0;
  const owes = tab.people === 1 ? `they owe ${format(top)}` : `${who} owe ${format(top)} each`;
  const rest = minor - covered;
  return rest > 0
    ? `${mine} · ${owes} · ${format(rest)} comes back from nobody`
    : `${mine} · ${owes}`;
}
