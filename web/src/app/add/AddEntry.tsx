'use client';

import { useState, useTransition, useEffect } from 'react';
import { Icon, RAIL_ICON, RAIL_TINT, ACCOUNT_ICON, ACCOUNT_TINT, tintOf } from '../Icon';
import { HEADER_BG } from '../auth-ui';
import { useRouter } from 'next/navigation';
import { pushKey, popKey, fromKeys } from '@/lib/money';
import { useMoney } from '@/app/currency';
import { saveEntry, checkDuplicate } from './actions';
import { haptic } from '../haptics';
import { enqueue, writePickers, type Queued } from './queue';
import { shares } from '../tab/splits';

/* Add Entry — the screen the whole product rests on.
   With no bank feed and no SMS, this is how nearly everything gets in, so it
   is built for three taps: amount, category chip, Save. The keypad is drawn
   in rather than borrowed from the system, because Save has to sit inside it —
   a pinned button at the bottom of the page ends up underneath the OS
   keyboard, which was the blocking finding in the audit.                     */

type Kind = 'expense' | 'income' | 'transfer';

const KINDS: { id: Kind; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
];

export type Category = { id: string; name: string; tint: string; icon: string };
export type Method = { id: string; name: string; funds: string; kind: string; funds_id: string };
export type Account = { id: string; name: string; kind: string };
export type Tab = { id: string; name: string; people: number; last_counts: boolean | null };
/** An open claim, for the income screen to point money at. */
export type Claim = {
  id: string; person: string; tint: string; tab: string | null; what: string;
  on: string; outstanding: number;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '.'];

export default function AddEntry({
  categories, methods, accounts, tabs = [], claims = [], today, householdId, draft, offline = false, onQueued, children,
}: {
  categories: Category[]; methods: Method[]; accounts: Account[]; tabs?: Tab[]; claims?: Claim[]; today: string;
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
  /** Drawn between the form and the keypad — the offline screen's pending list. */
  children?: React.ReactNode;
}) {
  const { currency, format, symbol, keysDisplay } = useMoney();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kept, setKept] = useState<string | null>(null);

  /* Opened with signal, so remember what the pickers hold. This is what lets
     the offline screen offer the same categories and ways of paying — names
     only, no amounts, no entries — and it is replaced on every visit. */
  useEffect(() => {
    if (offline) return;
    writePickers({ householdId, categories, methods, accounts, tabs, savedAt: new Date().toISOString() });
  }, [offline, householdId, categories, methods, accounts, tabs]);
  /* A scan hands its draft over here rather than saving anything itself. The
     keypad is seeded with the amount so it stays the same control, correctable
     the same way — a scanned figure is a suggestion, not a fact. */
  const [kind, setKind] = useState<Kind>(draft?.kind ?? 'expense');
  const [keys, setKeys] = useState(
    draft?.amountMinor ? String(draft.amountMinor / 100) : '');
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
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
  const [methodId, setMethodId] = useState(
    methods.find((m) => m.funds_id === draft?.fromAccountId)?.id ?? methods[0]?.id ?? '');
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
  const method = methods.find((m) => m.id === methodId) ?? methods[0];
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

  function save() {
    setError(null);
    setKept(null);
    const draft = {
      kind, amountMinor: minor, categoryId, methodId,
      counterAccountId: counterId, merchant, occurredOn, isShared: shared,
      tabId: kind === 'expense' ? tabId : null,
      tabCoveredMinor: kind === 'expense' && tabId && coveredKeys ? fromKeys(coveredKeys) : null,
      countsAsSpend: kind === 'expense' && tabId ? mine : null,
      settles: settling.map((c) => c.id),
    };
    const clear = () => { setKeys(''); setCategoryId(null); setMerchant(''); setDupe(null); };
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
  // A transfer moves money and can never wear a category — the same rule the
  // database enforces, applied here so the field simply is not offered.
  const wantsCategory = kind !== 'transfer';
  const canSave = minor > 0 && (!wantsCategory || categoryId !== null || allBack)
    && (kind !== 'transfer' || counterId !== null) && !pending;

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      <header
        className="el2"
        style={{
          background: HEADER_BG,
          color: '#fff',
          borderRadius: '0 0 26px 26px',
          padding: '18px var(--gutter) 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button aria-label="Close" style={iconBtn}
            onClick={() => { haptic('select'); router.push('/', { transitionTypes: ['nav-back'] }); }}>
            <Glyph d="M6 6l12 12M18 6L6 18" />
          </button>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-2)' }}>New entry</h1>
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
        </div>

        <div role="tablist" aria-label="Kind of entry" style={{ display: 'flex', gap: 3, padding: 3, background: 'rgba(0,0,0,.22)', borderRadius: 999 }}>
          {KINDS.map((k) => {
            const on = k.id === kind;
            return (
              <button
                key={k.id}
                role="tab"
                aria-selected={on}
                onClick={() => { setKind(k.id); if (k.id === 'transfer') setCategoryId(null); }}
                style={{
                  flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600,
                  background: on ? '#fff' : 'transparent',
                  color: on ? '#233D4D' : 'rgba(255,255,255,.86)',
                }}
              >
                {k.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            <span className="n" style={{ fontSize: 'var(--step-3)', fontWeight: 500, color: 'rgba(255,255,255,.62)' }}>
              {symbol}
            </span>
            <span className="n" aria-live="polite" style={{ fontSize: 'var(--step-4)', fontWeight: 600, letterSpacing: '-.036em', lineHeight: 1.05 }}>
              {keysDisplay(keys)}
            </span>
            <span style={{ width: 2, height: 34, background: 'rgba(255,255,255,.85)', marginLeft: 3, alignSelf: 'center' }} />
          </div>
          {/* The code, for a symbol that does not spell it: ₹ says INR to one
              household and nothing to a guest. AED already says AED. */}
          {symbol.trim() !== currency && (
            <span style={{ ...chip, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', color: '#fff' }}>
              {currency}
            </span>
          )}
        </div>
      </header>

      {/* Every way to pay, at once. This was a row that advanced to the next
          method on each tap, which meant a household with five of them could
          only find the fifth by tapping four times past the others — and could
          not see that it had five at all. */}
      <div style={{ padding: '6px 18px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)' }}>
          {kind === 'transfer' ? 'Out of' : kind === 'income' ? 'Came in by' : 'Paid with'}
        </span>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {methods.map((m) => {
            const on = m.id === methodId;
            const [bg, ink] = tintOf(RAIL_TINT[m.kind]);
            return (
              <button
                key={m.id}
                onClick={() => { haptic('select'); setMethodId(m.id); }}
                aria-pressed={on}
                title={m.funds === m.name ? m.name : `${m.name} — leaves ${m.funds}`}
                style={{
                  minHeight: 44, padding: '0 13px 0 9px', display: 'flex', alignItems: 'center', gap: 8,
                  borderRadius: 999, flex: 'none', whiteSpace: 'nowrap',
                  fontSize: 'var(--step--1)', fontWeight: 600,
                  background: on ? ink : bg,
                  color: on ? '#fff' : ink,
                  border: `1px solid ${on ? ink : 'transparent'}`,
                  transition: 'background .15s, color .15s',
                }}
              >
                <Icon name={RAIL_ICON[m.kind] ?? 'wallet'} size={17} strokeWidth={1.9} />
                {m.name}
              </button>
            );
          })}
        </div>
        {method && method.funds !== method.name && (
          <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
            Leaves {method.funds}
          </span>
        )}
      </div>

      {/* Where a transfer lands, on the same terms: every account visible.
          The date used to be REPLACED by this row, so a transfer could only
          ever be recorded as happening today. */}
      {kind === 'transfer' && (
        <div style={{ padding: '0 18px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)' }}>Into</span>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {accounts.filter((a) => a.id !== method?.funds_id).map((a) => {
              const on = a.id === counterId;
              const [bg, ink] = tintOf(ACCOUNT_TINT[a.kind]);
              return (
                <button
                  key={a.id}
                  onClick={() => { haptic('select'); setCounterId(a.id); }}
                  aria-pressed={on}
                  style={{
                    minHeight: 44, padding: '0 13px 0 9px', display: 'flex', alignItems: 'center', gap: 8,
                    borderRadius: 999, flex: 'none', whiteSpace: 'nowrap',
                    fontSize: 'var(--step--1)', fontWeight: 600,
                    background: on ? ink : bg, color: on ? '#fff' : ink,
                    border: `1px solid ${on ? ink : 'transparent'}`,
                    transition: 'background .15s, color .15s',
                  }}
                >
                  <Icon name={ACCOUNT_ICON[a.kind] ?? 'bank'} size={17} strokeWidth={1.9} />
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="el card" style={{ margin: '0 18px 12px', background: 'var(--c-card)', borderRadius: 18, padding: '2px 16px' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56,
        }}>
          <span style={{
            width: 92, flex: 'none', fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)',
          }}>Date</span>
          <input
            type="date" value={occurredOn} max={today}
            onChange={(e) => setOccurredOn(e.target.value || today)}
            style={{
              flex: 1, minHeight: 48, border: 0, background: 'transparent',
              color: 'var(--c-ink)', fontSize: 'var(--field)', fontWeight: 600,
            }}
          />
        </label>
      </div>

      {wantsCategory && (
        <div style={{ padding: '0 18px 12px' }}>
          <input
            value={merchant} onChange={(e) => setMerchant(e.target.value.slice(0, 60))}
            placeholder="Where was it" maxLength={60}
            style={{
              width: '100%', minHeight: 50, borderRadius: 13, padding: '0 14px',
              border: '1px solid var(--c-border)', background: 'var(--c-card)',
              color: 'var(--c-ink)', fontSize: 'var(--field)',
            }}
          />
        </div>
      )}

      {wantsCategory && (
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categories.map((c) => {
            const on = c.id === categoryId;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryId(on ? null : c.id)}
                aria-pressed={on}
                style={{
                  minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center',
                  borderRadius: 999, flex: 'none', whiteSpace: 'nowrap', fontSize: 'var(--step--1)', fontWeight: 600,
                  scrollSnapAlign: 'start',
                  gap: 7,
                  background: on ? `var(--cat-${c.tint}-ink)` : `var(--cat-${c.tint})`,
                  color: on ? '#fff' : `var(--cat-${c.tint}-ink)`,
                }}
              >
                <Icon name={c.icon} size={16} strokeWidth={1.9} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {kind === 'income' && claims.length > 0 && (
        <div style={{ padding: '2px 18px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)' }}>
            Clears what is owed
          </span>
          <div role="group" aria-label="Which entries this money clears" style={{
            display: 'flex', flexDirection: 'column', borderRadius: 14,
            background: 'var(--c-card)', border: '1px solid var(--c-border)', overflow: 'hidden',
          }}>
            {claims.map((c, i) => {
              const on = settleIds.has(c.id);
              const [bg, ink] = tintOf(c.tint);
              return (
                <button key={c.id} type="button" aria-pressed={on}
                  onClick={() => {
                    haptic('select');
                    setSettleIds((s) => { const n = new Set(s); if (on) n.delete(c.id); else n.add(c.id); return n; });
                  }}
                  style={{
                    minHeight: 54, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 11,
                    textAlign: 'left', background: on ? 'var(--c-teal-l)' : 'transparent',
                    color: 'var(--c-ink)',
                    borderTop: i === 0 ? undefined : '1px solid var(--c-rule)',
                  }}>
                  <span aria-hidden style={{
                    width: 22, height: 22, flex: 'none', borderRadius: 7, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: on ? 'var(--c-primary-hi)' : 'var(--c-sunk2)',
                    border: `1px solid ${on ? 'var(--c-primary-hi)' : 'var(--c-border)'}`,
                    color: 'var(--c-on-primary)',
                  }}>
                    {on && <Icon name="check" size={15} strokeWidth={2.6} />}
                  </span>
                  <span style={{
                    width: 30, height: 30, flex: 'none', borderRadius: 999, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--2)',
                    fontWeight: 700, background: bg, color: ink,
                  }}>{c.person.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{
                      fontSize: 'var(--step--1)', fontWeight: 600, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.person} · {c.what}</span>
                    <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                      {friendly(c.on)}{c.tab ? ` · ${c.tab}` : ''}
                    </span>
                  </span>
                  <span className="t" style={{ fontSize: 'var(--step--1)', color: 'var(--c-in)' }}>
                    {format(c.outstanding)}
                  </span>
                </button>
              );
            })}
          </div>
          {settling.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ flex: 1, margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
                {minor <= 0
                  ? `${format(owedBack)} owed across ${settling.length === 1 ? 'this entry' : `these ${settling.length}`}.`
                  : minor <= owedBack
                    ? `All ${format(minor)} is money back${minor < owedBack ? `, oldest first — ${format(owedBack - minor)} stays owed` : ''}. No category needed.`
                    : `${format(owedBack)} is money back · ${format(minor - owedBack)} is income and needs a category.`}
              </p>
              {minor !== owedBack && (
                <button type="button" onClick={() => { haptic('select'); setKeys(String(owedBack / 100)); }} style={{
                  minHeight: 40, padding: '0 12px', borderRadius: 999, flex: 'none',
                  fontSize: 'var(--step--2)', fontWeight: 600,
                  background: 'var(--c-sunk)', color: 'var(--c-ink)',
                }}>Use {format(owedBack)}</button>
              )}
            </div>
          )}
        </div>
      )}

      {kind === 'expense' && tabs.length > 0 && (
        <div style={{ padding: '2px 18px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {tabs.map((t) => {
              const on = t.id === tabId;
              return (
                <button
                  key={t.id}
                  onClick={() => { haptic('select'); setTabId(on ? null : t.id); }}
                  aria-pressed={on}
                  style={{
                    minHeight: 44, padding: '0 14px 0 11px', display: 'flex', alignItems: 'center', gap: 7,
                    borderRadius: 999, flex: 'none', whiteSpace: 'nowrap',
                    fontSize: 'var(--step--1)', fontWeight: 600,
                    background: on ? 'var(--cat-purple-ink)' : 'var(--c-card)',
                    color: on ? '#fff' : 'var(--c-ink)',
                    border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'var(--cat-purple-ink)' : 'var(--c-dash)'}`,
                  }}
                >
                  <Icon name="tab" size={16} strokeWidth={1.9} />
                  {t.name}
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
                  value={coveredKeys}
                  onChange={(e) => setCoveredKeys(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder={minor > 0 ? `all of it — ${format(minor)}` : 'all of it'}
                  aria-label="How much of this comes back"
                  style={{
                    flex: 1, minWidth: 0, minHeight: 40, padding: '0 12px', borderRadius: 11,
                    background: 'var(--c-card)', border: '1px solid var(--c-border)',
                    color: 'var(--c-ink)', fontSize: 'var(--field)',
                  }}
                />
              </label>
              {/* Two answers, both on screen, because a tab carries both kinds:
                  the petrol you burned and are paid back for, and the ticket
                  you fronted that was never yours. */}
              <div role="group" aria-label="Was this your spending?" style={{ display: 'flex', gap: 8 }}>
                {([
                  [true, 'receivable', 'Mine, paid back', 'In the month and the charts'],
                  [false, 'person', 'Lent, not mine', 'Owed back, counted nowhere'],
                ] as const).map(([v, icon, label, what]) => {
                  const on = mine === v;
                  return (
                    <button key={String(v)} type="button" aria-pressed={on}
                      onClick={() => { haptic('select'); setCounts(v); }}
                      style={{
                        flex: 1, minHeight: 56, padding: '8px 12px', borderRadius: 13, textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 9,
                        background: on ? 'var(--cat-purple-ink)' : 'var(--c-card)',
                        color: on ? '#fff' : 'var(--c-ink)',
                        border: `1px solid ${on ? 'var(--cat-purple-ink)' : 'var(--c-border)'}`,
                      }}>
                      <Icon name={icon} size={17} strokeWidth={1.9} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--step--1)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 'var(--step--2)', opacity: on ? 0.82 : 0.7, lineHeight: 1.3 }}>{what}</span>
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
        </div>
      )}

      {shownDupe && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 var(--gutter) 12px',
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-pollen)', color: 'var(--c-on-fill)',
        }}>
          <Glyph d="M12 7.5v5.5 M12 16.6v.1 M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0" size={17} w={1.9} />
          <span style={{ flex: 1, fontSize: 'var(--step--1)', lineHeight: 1.45 }}>
            <b>{shownDupe.who}</b> already recorded {format(shownDupe.amountMinor)}
            {shownDupe.merchant ? ` at ${shownDupe.merchant}` : ''} on {friendly(shownDupe.on)}, from {shownDupe.account}.
            Is this the same thing?
          </span>
        </div>
      )}

      {kept && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '0 var(--gutter) 12px',
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-teal-l)', color: 'var(--c-ink)',
          fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.4,
        }}>
          <Glyph d="M12 3a9 9 0 1 0 9 9 M12 8v4l3 2" size={17} w={2} />
          {kept}
        </div>
      )}

      {error && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '0 var(--gutter) 12px',
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
          fontSize: 'var(--step--1)', fontWeight: 600,
        }}>
          <Glyph d="M12 7.5v5.5 M12 16.6v.1 M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0" size={17} w={2} />
          {error}
        </div>
      )}

      <button
        onClick={() => setShared((s) => !s)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '0 var(--gutter) 12px',
          minHeight: 56, padding: '0 16px', borderRadius: 16,
          background: 'var(--c-card)', border: '1px solid var(--c-border)',
        }}
      >
        <span style={{ flex: 1, fontSize: 'var(--step-0)', fontWeight: 600 }}>Shared with the household</span>
        <span style={{
          width: 50, height: 30, borderRadius: 999, flex: 'none', padding: 3, display: 'flex',
          justifyContent: shared ? 'flex-end' : 'flex-start',
          background: shared ? 'var(--c-seagrass)' : 'var(--c-off)',
        }}>
          <span style={{ width: 24, height: 24, borderRadius: 999, background: '#fff' }} />
        </span>
      </button>

      {children}

      <div style={{ marginTop: 'auto', padding: '10px 14px 18px', background: 'var(--c-card)', borderTop: '1px solid var(--c-border)', display: 'flex', gap: 9 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 9 }}>
          {KEYS.map((k) => (
            <button key={k} className="n press" onClick={() => { haptic('tap'); setKeys((s) => pushKey(s, k)); }} style={key}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ width: 92, flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button aria-label="Delete" className="press" onClick={() => { haptic('tap'); setKeys(popKey); }} style={{ ...key, background: 'var(--c-sunk)', color: 'var(--c-meta)' }}>
            <Glyph d="M9.5 5.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9L3 12Z M13 9.5l4 5 M17 9.5l-4 5" size={23} />
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="el2"
            style={{
              flex: 1, minHeight: 169, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
              color: '#fff', opacity: canSave ? 1 : 0.45,
              background:
                'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),' +
                'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
            }}
          >
            <Glyph d="M5 12.5 10 17.5 19 7" size={24} w={2.2} />
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  width: 44, height: 44, marginLeft: -10, borderRadius: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.86)',
};
const chip: React.CSSProperties = {
  minHeight: 44, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6,
  borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600, flex: 'none',
};
const key: React.CSSProperties = {
  minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 14, background: 'var(--c-sunk2)', fontSize: 'var(--step-3)', fontWeight: 600, color: 'var(--c-ink)',
};

function friendly(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const same = d.getTime() === today.getTime();
  const s = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return same ? `Today, ${s}` : s;
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
