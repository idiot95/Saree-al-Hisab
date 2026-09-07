'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { haptic } from './haptics';
import { scan } from './scan/actions';

/* The sheet behind the plus button: type it in, photograph a receipt, or pick
   a photo already on the phone. The two file choices go straight to the
   scanner from here — no screen in between — and the result lands on Add
   Entry as a draft with every field still editable, which is the rule for
   scans: nothing is ever posted from a photo, only suggested. */
export default function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [state, act, pending] = useActionState(scan, null);
  const formRef = useRef<HTMLFormElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  // The last result acted on, so an effect re-run does not push twice.
  const handled = useRef<typeof state>(null);

  // Escape closes it, and the page under it stops scrolling while it is up.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = was; };
  }, [open, onClose]);

  /* A readable receipt goes to Add Entry at once, seeded the same way the
     scan screen seeds it. One that could not be read stays here with the
     reason, and a blank entry is one tap away. */
  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok && state.missing.length === 0) {
      const p = new URLSearchParams();
      const s = state.scan;
      if (s.amountMinor) p.set('amount', String(s.amountMinor));
      if (s.occurredOn) p.set('on', s.occurredOn);
      if (s.merchant) p.set('merchant', s.merchant);
      if (s.kind !== 'unknown') p.set('kind', s.kind);
      if (state.suggestedCategoryId) p.set('category', state.suggestedCategoryId);
      haptic('success');
      onClose();
      router.push(`/add?${p.toString()}`, { transitionTypes: ['nav-forward'] });
    } else {
      haptic('warn');
    }
  }, [state, onClose, router]);

  if (!open) return null;

  const problem = !state ? null
    : !state.ok ? state.error
    : state.missing.length > 0 ? `Could not read ${state.missing.join(', ')}. Type it in instead — a figure guessed from a blurred receipt is worse than one you typed.`
    : null;

  // The file input is the whole gesture: choose a file, and the form goes.
  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) formRef.current?.requestSubmit();
  };

  return (
    <div role="presentation" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,23,30,.42)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div role="dialog" aria-modal="true" aria-label="Add" className="snack el2"
        onClick={(e) => e.stopPropagation()} style={{
          width: '100%', maxWidth: 520, background: 'var(--c-card)', color: 'var(--c-ink)',
          borderRadius: '24px 24px 0 0', padding: '10px var(--gutter) calc(18px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
        <span aria-hidden style={{
          width: 38, height: 4, borderRadius: 999, background: 'var(--c-border)', alignSelf: 'center', marginBottom: 6,
        }} />

        <form ref={formRef} action={act} style={{ display: 'contents' }}>
          <input ref={cameraRef} type="file" name="receipt" hidden
            accept="image/png,image/jpeg,image/webp" capture="environment" onChange={picked} />
          {/* Two inputs share a name so the form only ever carries the one used;
              the other stays empty and is ignored by the server. */}
          <input ref={filesRef} type="file" name="receipt" hidden
            accept="image/png,image/jpeg,image/webp,application/pdf" onChange={picked} />
        </form>

        <Choice icon="pencil" tint="teal" title="Type it in" note="Amount, category, save — three taps"
          disabled={pending}
          onPick={() => { haptic('select'); onClose(); router.push('/add', { transitionTypes: ['nav-forward'] }); }} />
        <Choice icon="camera" tint="pumpkin" title={pending ? 'Reading the receipt…' : 'Scan a receipt'}
          note="Photograph it; the total, date and shop are read for you"
          disabled={pending}
          onPick={() => { haptic('select'); filesRef.current!.value = ''; cameraRef.current?.click(); }} />
        <Choice icon="upload" tint="purple" title="Upload a photo or PDF"
          note="A screenshot or a bill already on the phone"
          disabled={pending}
          onPick={() => { haptic('select'); cameraRef.current!.value = ''; filesRef.current?.click(); }} />

        {problem && (
          <p role="alert" style={{
            margin: '4px 0 0', padding: '12px 14px', borderRadius: 13, fontSize: 'var(--step--1)',
            lineHeight: 1.5, background: 'var(--c-warn-tint)', color: 'var(--c-warn)', fontWeight: 600,
          }}>{problem}</p>
        )}

        <button type="button" className="cta" onClick={onClose} style={{
          marginTop: 4, minHeight: 48, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
      </div>
    </div>
  );
}

const TINTS: Record<string, [string, string]> = {
  teal: ['var(--c-teal-l)', 'var(--c-teal)'],
  pumpkin: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
};

function Choice({ icon, tint, title, note, onPick, disabled }: {
  icon: string; tint: string; title: string; note: string; onPick: () => void; disabled: boolean;
}) {
  const [bg, ink] = TINTS[tint];
  return (
    <button type="button" onClick={onPick} disabled={disabled} className="el" style={{
      minHeight: 66, borderRadius: 16, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 13,
      textAlign: 'left', background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
      color: 'var(--c-ink)', opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{
        width: 42, height: 42, flex: 'none', borderRadius: 12, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: bg, color: ink,
      }}>
        <Icon name={icon} size={21} strokeWidth={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.4, color: 'var(--c-meta)' }}>{note}</span>
      </span>
    </button>
  );
}
