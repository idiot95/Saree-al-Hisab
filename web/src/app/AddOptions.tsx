'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { haptic } from './haptics';
import { scan } from './scan/actions';
import { TAB_BAR_SPACE } from './tabs';

/* The choices behind the plus button: type it in, photograph a receipt, or
   pick a photo already on the phone. They float above the plus over the
   screen blurred, not in a drawer that covers it — what you were reading
   stays where it was, and the option you take is within reach of the thumb
   that opened them. The two file choices go straight to the scanner from
   here, and the result lands on Add Entry as a draft with every field still
   editable, which is the rule for scans: nothing is ever posted from a
   photo, only suggested. */
export default function AddOptions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [state, act, pending] = useActionState(scan, null);
  const formRef = useRef<HTMLFormElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  // The last result acted on, so an effect re-run does not push twice.
  const handled = useRef<typeof state>(null);

  /* Escape closes it, the page under it stops scrolling while it is up, and
     the keyboard lands on the first choice — then goes back where it was. */
  useEffect(() => {
    if (!open) return;
    const from = document.activeElement as HTMLElement | null;
    firstRef.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = was;
      from?.focus?.({ preventScroll: true });
    };
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
    <>
      {/* The veil sits under the tab bar (z 35 against its 40), so the bar
          stays sharp and the plus — now a cross — is still the thing to tap. */}
      <div className="veil" role="presentation" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label="Add" style={{
        position: 'fixed', left: 0, right: 0, zIndex: 36,
        bottom: `calc(${TAB_BAR_SPACE} + 16px)`,
        display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 10,
        padding: '0 var(--gutter)', pointerEvents: 'none',
      }}>
        <form ref={formRef} action={act} style={{ display: 'contents' }}>
          <input ref={cameraRef} type="file" name="receipt" hidden
            accept="image/png,image/jpeg,image/webp" capture="environment" onChange={picked} />
          {/* Two inputs share a name so the form only ever carries the one used;
              the other stays empty and is ignored by the server. */}
          <input ref={filesRef} type="file" name="receipt" hidden
            accept="image/png,image/jpeg,image/webp,application/pdf" onChange={picked} />
        </form>

        {/* Nearest the thumb first: the column is reversed, so the first
            choice in the source is the lowest on the screen and the first
            to arrive. */}
        <Ghost i={0} ref={firstRef} icon="pencil" tint="teal" title="Type it in"
          note="Amount, category, save — three taps" disabled={pending}
          onPick={() => { haptic('select'); onClose(); router.push('/add', { transitionTypes: ['nav-forward'] }); }} />
        <Ghost i={1} icon="camera" tint="pumpkin"
          title={pending ? 'Reading the receipt…' : 'Scan a receipt'}
          note="The total, date and shop are read for you" disabled={pending}
          onPick={() => { haptic('select'); filesRef.current!.value = ''; cameraRef.current?.click(); }} />
        <Ghost i={2} icon="upload" tint="purple" title="Upload a photo or PDF"
          note="A screenshot or a bill already on the phone" disabled={pending}
          onPick={() => { haptic('select'); cameraRef.current!.value = ''; filesRef.current?.click(); }} />

        {problem && (
          <p role="alert" className="ghost" style={{
            '--i': 3, margin: 0, width: 'min(100%, 360px)', pointerEvents: 'auto',
            padding: '12px 16px', borderRadius: 18, fontSize: 'var(--step--1)',
            lineHeight: 1.5, color: 'var(--c-warn)', fontWeight: 600,
          } as React.CSSProperties}>{problem}</p>
        )}
      </div>
    </>
  );
}

const TINTS: Record<string, [string, string]> = {
  teal: ['var(--c-teal-l)', 'var(--c-teal)'],
  pumpkin: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
};

function Ghost({ i, icon, tint, title, note, onPick, disabled, ref }: {
  i: number; icon: string; tint: string; title: string; note: string;
  onPick: () => void; disabled: boolean; ref?: React.Ref<HTMLButtonElement>;
}) {
  const [bg, ink] = TINTS[tint];
  return (
    <button ref={ref} type="button" onClick={onPick} disabled={disabled} className="ghost" style={{
      '--i': i, width: 'min(100%, 360px)', minHeight: 62, borderRadius: 999,
      padding: '0 20px 0 9px', display: 'flex', alignItems: 'center', gap: 13,
      textAlign: 'left', color: 'var(--c-ink)', opacity: disabled ? 0.6 : 1, pointerEvents: 'auto',
    } as React.CSSProperties}>
      <span style={{
        width: 44, height: 44, flex: 'none', borderRadius: 999, display: 'flex',
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
