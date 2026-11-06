'use client';

import Link from '@/app/NavLink';
import { useActionState, useState } from 'react';
import { ErrorNote, primaryBtn } from '../auth-ui';
import { Icon } from '../Icon';
import { scan } from './actions';
import { useMoney } from '@/app/currency';

const card = 'flex flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]';

export default function ScanForm({ canScan }: { canScan: boolean }) {
  const [state, act, pending] = useActionState(scan, null);
  const [picked, setPicked] = useState<string | null>(null);

  if (!canScan) {
    return (
      <div className={card}>
        <p className="flex items-start gap-2 text-sm leading-normal text-muted-foreground">
          <Icon name="key" size={18} className="mt-px flex-none" />
          <span>
            Scanning needs a Google AI key, which is free and takes a minute to get. An owner
            adds it once under Household.
          </span>
        </p>
        <Link transitionTypes={['nav-forward']} href="/household" className={primaryBtn}>Go to Household</Link>
      </div>
    );
  }

  return (
    <>
      <form action={act} aria-label="Scan a receipt" className={card}>
        <label className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-input bg-background p-4 text-center">
          <input
            type="file" name="receipt" accept="image/png,image/jpeg,image/webp,application/pdf"
            capture="environment" required className="hidden"
            onChange={(e) => setPicked(e.target.files?.[0]?.name ?? null)}
          />
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <Icon name={picked ? 'check' : 'photo_camera'} size={24} />
          </span>
          <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">
            {picked ?? 'Photograph the receipt'}
          </span>
          <span className="text-sm text-muted-foreground">
            Or pick a screenshot or PDF. Up to 6 MB.
          </span>
        </label>

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

        <button type="submit" disabled={pending} className={primaryBtn}>
          <Icon name="document_scanner" size={20} />
          {pending ? 'Reading it…' : 'Read the receipt'}
        </button>
      </form>

      {state?.ok && <Draft result={state} />}
    </>
  );
}

const CONFIDENCE = {
  high: { icon: 'check_circle', cls: 'bg-accent text-accent-foreground' },
  medium: { icon: 'warning', cls: 'bg-attention-soft text-attention-soft-foreground' },
  low: { icon: 'error', cls: 'bg-destructive/10 text-destructive' },
} as const;

/* What was found, and what is missing. Nothing has been written: the button
   carries the draft to Add Entry, where a person saves it as they would any
   other. */
function Draft({ result }: {
  result: { scan: import('@/lib/receipt').Scanned; missing: string[]; suggestedCategoryId: string | null };
}) {
  const { format } = useMoney();
  const s = result.scan;
  const params = new URLSearchParams();
  if (s.amountMinor) params.set('amount', String(s.amountMinor));
  if (s.occurredOn) params.set('on', s.occurredOn);
  if (s.merchant) params.set('merchant', s.merchant);
  if (s.kind !== 'unknown') params.set('kind', s.kind);
  if (result.suggestedCategoryId) params.set('category', result.suggestedCategoryId);

  const blocked = result.missing.length > 0;
  const conf = CONFIDENCE[s.confidence as keyof typeof CONFIDENCE] ?? CONFIDENCE.low;

  return (
    <section aria-label="What it read" className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${conf.cls}`}>
          <Icon name={conf.icon} size={14} />{s.confidence.charAt(0).toUpperCase() + s.confidence.slice(1)} confidence
        </span>
        <span className="text-sm text-muted-foreground">Nothing saved yet</span>
      </div>

      <dl className="flex flex-col">
        <Line label="Amount" value={s.amountMinor ? format(s.amountMinor) : null} />
        <Line label="Date" value={s.occurredOn} />
        <Line label="Where" value={s.merchant} />
        <Line label="Kind" value={s.kind === 'unknown' ? null
          : s.kind === 'expense' ? 'Money out' : 'Money in'} />
        {s.note && <Line label="Note" value={s.note} />}
      </dl>

      {blocked ? (
        <p className="flex items-start gap-2 rounded-xl bg-attention-soft px-3.5 py-3 text-sm font-semibold leading-normal text-attention-soft-foreground">
          <Icon name="warning" size={18} className="mt-px flex-none" />
          <span>
            Could not read {result.missing.join(', ')}. Open a blank entry and fill it in — a
            figure guessed from a blurred receipt is worse than one you typed.
          </span>
        </p>
      ) : null}

      <Link href={blocked ? '/add' : `/add?${params.toString()}`} className={primaryBtn}>
        {blocked ? 'Enter it myself' : 'Check it and save'}
      </Link>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-h-[46px] items-center gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="flex-1 text-sm text-muted-foreground">{label}</dt>
      <dd className={`flex items-center gap-1 text-right text-[15px] font-semibold [overflow-wrap:anywhere] ${value ? 'text-foreground' : 'text-destructive'}`}>
        {!value && <Icon name="error" size={16} />}{value ?? 'not readable'}
      </dd>
    </div>
  );
}
