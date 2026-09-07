'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ErrorNote } from '../auth-ui';
import { scan } from './actions';
import { format } from '@/lib/money';

export default function ScanForm({ canScan }: { canScan: boolean }) {
  const [state, act, pending] = useActionState(scan, null);
  const [picked, setPicked] = useState<string | null>(null);

  if (!canScan) {
    return (
      <div className="el" style={card}>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.55, color: 'var(--c-meta)' }}>
          Scanning needs a Google AI key, which is free and takes a minute to get. An owner
          adds it once under Household.
        </p>
        <Link transitionTypes={['nav-forward']} href="/household" style={{
          minHeight: 48, borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', textDecoration: 'none', fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
        }}>Go to Household</Link>
      </div>
    );
  }

  return (
    <>
      <form action={act} className="el" style={card}>
        <label style={{
          minHeight: 130, borderRadius: 15, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
          background: 'var(--c-sunk2)', border: '1.5px dashed var(--c-dash)', padding: 16,
        }}>
          <input
            type="file" name="receipt" accept="image/png,image/jpeg,image/webp,application/pdf"
            capture="environment" required style={{ display: 'none' }}
            onChange={(e) => setPicked(e.target.files?.[0]?.name ?? null)}
          />
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="var(--c-meta)"
            strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4.5 8.5 6 6h4l1-1.5h2L14 6h4l1.5 2.5v9a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" />
            <circle cx="12" cy="12.5" r="3.4" />
          </svg>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
            {picked ?? 'Photograph the receipt'}
          </span>
          <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)', textAlign: 'center' }}>
            Or pick a screenshot or PDF. Up to 6 MB.
          </span>
        </label>

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

        <button type="submit" disabled={pending} className="el2" style={{
          minHeight: 54, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600, color: '#fff',
          opacity: pending ? 0.6 : 1,
          background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
            + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
        }}>{pending ? 'Reading it…' : 'Read the receipt'}</button>
      </form>

      {state?.ok && <Draft result={state} />}
    </>
  );
}

/* What was found, and what is missing. Nothing has been written: the button
   carries the draft to Add Entry, where a person saves it as they would any
   other. */
function Draft({ result }: {
  result: { scan: import('@/lib/receipt').Scanned; missing: string[]; suggestedCategoryId: string | null };
}) {
  const s = result.scan;
  const params = new URLSearchParams();
  if (s.amountMinor) params.set('amount', String(s.amountMinor));
  if (s.occurredOn) params.set('on', s.occurredOn);
  if (s.merchant) params.set('merchant', s.merchant);
  if (s.kind !== 'unknown') params.set('kind', s.kind);
  if (result.suggestedCategoryId) params.set('category', result.suggestedCategoryId);

  const blocked = result.missing.length > 0;

  return (
    <section className="el" style={{ ...card, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.04em', padding: '5px 9px',
          borderRadius: 7,
          background: s.confidence === 'high' ? 'var(--c-ok-tint)'
            : s.confidence === 'medium' ? 'var(--c-warn-tint)' : 'var(--c-danger-tint)',
          color: s.confidence === 'high' ? 'var(--c-ok)'
            : s.confidence === 'medium' ? 'var(--c-warn)' : 'var(--c-danger)',
        }}>{s.confidence.toUpperCase()} CONFIDENCE</span>
        <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>Nothing saved yet</span>
      </div>

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Line label="Amount" value={s.amountMinor ? format(s.amountMinor) : null} />
        <Line label="Date" value={s.occurredOn} />
        <Line label="Where" value={s.merchant} />
        <Line label="Kind" value={s.kind === 'unknown' ? null
          : s.kind === 'expense' ? 'Money out' : 'Money in'} />
        {s.note && <Line label="Note" value={s.note} />}
      </dl>

      {blocked ? (
        <p style={{
          margin: 0, padding: '12px 14px', borderRadius: 13, fontSize: 'var(--step--1)', lineHeight: 1.5,
          background: 'var(--c-warn-tint)', color: 'var(--c-warn)', fontWeight: 600,
        }}>
          Could not read {result.missing.join(', ')}. Open a blank entry and fill it in — a
          figure guessed from a blurred receipt is worse than one you typed.
        </p>
      ) : null}

      <Link href={blocked ? '/add' : `/add?${params.toString()}`} className="el2" style={{
        minHeight: 52, borderRadius: 14, display: 'flex', alignItems: 'center',
        justifyContent: 'center', textDecoration: 'none', fontSize: 'var(--step-0)', fontWeight: 600,
        color: '#fff',
        background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
          + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
      }}>{blocked ? 'Enter it myself' : 'Check it and save'}</Link>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 46,
      borderBottom: '1px solid var(--c-rule)',
    }}>
      <dt style={{ flex: 1, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>{label}</dt>
      <dd style={{
        margin: 0, fontSize: 'var(--step-0)', fontWeight: 600,
        color: value ? 'var(--c-ink)' : 'var(--c-danger)',
      }}>{value ?? 'not readable'}</dd>
    </div>
  );
}

const card: React.CSSProperties = {
  margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: 16,
  display: 'flex', flexDirection: 'column', gap: 14,
};
