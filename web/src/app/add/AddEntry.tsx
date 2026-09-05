'use client';

import { useState, useTransition, useEffect } from 'react';
import { HEADER_BG } from '../auth-ui';
import { useRouter } from 'next/navigation';
import { keysDisplay, pushKey, popKey, fromKeys, symbolOf, format } from '@/lib/money';
import { saveEntry, checkDuplicate } from './actions';

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

export type Category = { id: string; name: string; tint: string };
export type Method = { id: string; name: string; funds: string };
export type Account = { id: string; name: string; kind: string };

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '.'];

export default function AddEntry({
  categories, methods, accounts, today,
}: { categories: Category[]; methods: Method[]; accounts: Account[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind>('expense');
  const [keys, setKeys] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [counterId, setCounterId] = useState<string | null>(null);
  const [shared, setShared] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dupe, setDupe] = useState<Awaited<ReturnType<typeof checkDuplicate>>>(null);

  const minor = fromKeys(keys);
  const method = methods.find((m) => m.id === methodId) ?? methods[0];

  /* Prevention beats detection: ask what is already recorded while they are
     still typing, so the warning arrives at the moment of the decision rather
     than as cleanup in the Inbox later. Debounced, because every keypress
     would otherwise be a round trip. */
  useEffect(() => {
    if (minor <= 0) { setDupe(null); return; }
    const t = setTimeout(() => { checkDuplicate(minor, today).then(setDupe).catch(() => {}); }, 450);
    return () => clearTimeout(t);
  }, [minor, today]);

  function save() {
    setError(null);
    start(async () => {
      const r = await saveEntry({
        kind, amountMinor: minor, categoryId, methodId,
        counterAccountId: counterId, merchant: '', occurredOn: today, isShared: shared,
      });
      if (r.ok) { setKeys(''); setCategoryId(null); setDupe(null); router.push('/'); }
      else setError(r.error);
    });
  }
  // A transfer moves money and can never wear a category — the same rule the
  // database enforces, applied here so the field simply is not offered.
  const wantsCategory = kind !== 'transfer';
  const canSave = minor > 0 && (!wantsCategory || categoryId !== null)
    && (kind !== 'transfer' || counterId !== null) && !pending;

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>
      <header
        className="el2"
        style={{
          background: HEADER_BG,
          color: '#fff',
          borderRadius: '0 0 26px 26px',
          padding: '18px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button aria-label="Close" style={iconBtn}>
            <Glyph d="M6 6l12 12M18 6L6 18" />
          </button>
          <h1 className="t" style={{ margin: 0, fontSize: 19 }}>New entry</h1>
          <span style={{ width: 44, height: 44 }} />
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
                  borderRadius: 999, fontSize: 13.5, fontWeight: 600,
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
            <span className="n" style={{ fontSize: 28, fontWeight: 500, color: 'rgba(255,255,255,.62)' }}>
              {symbolOf('INR')}
            </span>
            <span className="n" aria-live="polite" style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-.036em', lineHeight: 1.05 }}>
              {keysDisplay(keys)}
            </span>
            <span style={{ width: 2, height: 34, background: 'rgba(255,255,255,.85)', marginLeft: 3, alignSelf: 'center' }} />
          </div>
          <button style={{ ...chip, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', color: '#fff' }}>INR</button>
        </div>
      </header>

      <div className="el" style={{ margin: '-18px 18px 12px', background: 'var(--c-card)', borderRadius: 18, padding: '2px 16px' }}>
        <Row
          label={kind === 'transfer' ? 'From' : 'Paid with'}
          value={method?.name ?? '—'}
          hint={method && method.funds !== method.name ? `leaves ${method.funds}` : undefined}
          onClick={() => setMethodId(methods[(methods.findIndex((m) => m.id === methodId) + 1) % methods.length].id)}
        />
        {kind === 'transfer' ? (
          <Row
            label="Into"
            value={accounts.find((a) => a.id === counterId)?.name ?? 'Choose an account'}
            muted={!counterId}
            onClick={() => {
              const pick = accounts.filter((a) => a.id !== undefined);
              const i = pick.findIndex((a) => a.id === counterId);
              setCounterId(pick[(i + 1) % pick.length].id);
            }}
            last
          />
        ) : (
          <Row label="Date" value={friendly(today)} last />
        )}
      </div>

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
                  borderRadius: 999, flex: 'none', whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 600,
                  scrollSnapAlign: 'start',
                  background: on ? `var(--cat-${c.tint}-ink)` : `var(--cat-${c.tint})`,
                  color: on ? '#fff' : `var(--cat-${c.tint}-ink)`,
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {dupe && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 18px 12px',
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-pollen)', color: 'var(--c-on-fill)',
        }}>
          <Glyph d="M12 7.5v5.5 M12 16.6v.1 M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0" size={17} w={1.9} />
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
            <b>{dupe.who}</b> already recorded {format(dupe.amountMinor)}
            {dupe.merchant ? ` at ${dupe.merchant}` : ''} on {friendly(dupe.on)}, from {dupe.account}.
            Is this the same thing?
          </span>
        </div>
      )}

      {error && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '0 18px 12px',
          padding: '13px 15px', borderRadius: 14, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
          fontSize: 13.5, fontWeight: 600,
        }}>
          <Glyph d="M12 7.5v5.5 M12 16.6v.1 M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0" size={17} w={2} />
          {error}
        </div>
      )}

      <button
        onClick={() => setShared((s) => !s)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '0 18px 12px',
          minHeight: 56, padding: '0 16px', borderRadius: 16,
          background: 'var(--c-card)', border: '1px solid var(--c-border)',
        }}
      >
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>Shared with the household</span>
        <span style={{
          width: 50, height: 30, borderRadius: 999, flex: 'none', padding: 3, display: 'flex',
          justifyContent: shared ? 'flex-end' : 'flex-start',
          background: shared ? 'var(--c-seagrass)' : 'var(--c-off)',
        }}>
          <span style={{ width: 24, height: 24, borderRadius: 999, background: '#fff' }} />
        </span>
      </button>

      <div style={{ marginTop: 'auto', padding: '10px 14px 18px', background: 'var(--c-card)', borderTop: '1px solid var(--c-border)', display: 'flex', gap: 9 }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 9 }}>
          {KEYS.map((k) => (
            <button key={k} className="n" onClick={() => setKeys((s) => pushKey(s, k))} style={key}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ width: 92, flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button aria-label="Delete" onClick={() => setKeys(popKey)} style={{ ...key, background: 'var(--c-sunk)', color: 'var(--c-meta)' }}>
            <Glyph d="M9.5 5.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9L3 12Z M13 9.5l4 5 M17 9.5l-4 5" size={23} />
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="el2"
            style={{
              flex: 1, minHeight: 169, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6, borderRadius: 14, fontSize: 15, fontWeight: 600,
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
  borderRadius: 999, fontSize: 13, fontWeight: 600, flex: 'none',
};
const key: React.CSSProperties = {
  minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 14, background: 'var(--c-sunk2)', fontSize: 23, fontWeight: 600, color: 'var(--c-ink)',
};

function friendly(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const same = d.getTime() === today.getTime();
  const s = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return same ? `Today, ${s}` : s;
}

function Row({ label, value, hint, last, muted, onClick }: {
  label: string; value: string; hint?: string; last?: boolean; muted?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56,
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <span style={{ width: 92, flex: 'none', fontSize: 13.5, fontWeight: 600, color: 'var(--c-meta)' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600, color: muted ? 'var(--c-ph)' : undefined }}>{value}</span>
        {hint && <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>{hint}</span>}
      </span>
      <Glyph d="M9 5l7 7-7 7" size={18} colour="var(--c-faint)" />
    </button>
  );
}

function Glyph({ d, size = 21, w = 2, colour }: { d: string; size?: number; w?: number; colour?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour ?? 'currentColor'}
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden>
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
    </svg>
  );
}
