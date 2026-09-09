'use client';

import { useState } from 'react';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';

/* Asking for money back, without the app deciding how.

   A reminder goes wherever the household already talks — WhatsApp, a message,
   email — so this composes the sentence and hands it to the phone's own share
   sheet rather than sending anything itself. Nothing leaves the device until
   a person picks who it goes to, which is also why there is no contact list
   here: the share sheet already has one, and it is the one they keep.

   Where the phone can share files, the bills go with it, because "which
   flight?" is the next question after "you owe me 4,500". Where it cannot —
   most desktops, some browsers — the text goes on its own and says so rather
   than silently dropping the evidence. Clipboard is the last fallback. */

export type Bill = { id: string; name: string; mime: string };

export default function RemindShare({ person, what, amount, on, bills }: {
  person: string; what: string; amount: string; on: string; bills: Bill[];
}) {
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const day = new Date(`${on}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const text = `${person}, a reminder about ${amount} for ${what} on ${day}.`;

  const go = async () => {
    setBusy(true); setSaid(null);
    haptic('select');
    try {
      const files: File[] = [];
      if (bills.length && typeof navigator.canShare === 'function') {
        for (const b of bills.slice(0, 4)) {
          try {
            const res = await fetch(`/attachment/${b.id}`);
            if (!res.ok) continue;
            files.push(new File([await res.blob()], b.name, { type: b.mime }));
          } catch { /* one unreadable bill must not lose the reminder */ }
        }
      }
      const withFiles = files.length > 0 && navigator.canShare?.({ files });
      if (typeof navigator.share === 'function') {
        await navigator.share(withFiles ? { text, files } : { text });
        setSaid(bills.length > 0 && !withFiles
          ? 'Sent without the bills — this phone will not share files.'
          : null);
      } else {
        await navigator.clipboard.writeText(text);
        setSaid('Copied. Paste it wherever you like.');
      }
    } catch (e) {
      // A cancelled share sheet is not a failure and must not look like one.
      if ((e as Error)?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(text);
          setSaid('Copied. Paste it wherever you like.');
        } catch { setSaid('Could not share from this browser.'); }
      }
    }
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <button type="button" onClick={go} disabled={busy} style={{
        minHeight: 40, padding: '0 13px', borderRadius: 11, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 7,
        fontSize: 'var(--step--2)', fontWeight: 700,
        background: 'var(--c-sunk)', color: 'var(--c-ink)',
      }}>
        <Icon name="upload" size={15} strokeWidth={2} />
        {busy ? 'Preparing…' : bills.length > 0 ? `Remind · ${bills.length} bill${bills.length === 1 ? '' : 's'}` : 'Remind'}
      </button>
      {said && (
        <span role="status" style={{ fontSize: 'var(--step--2)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
          {said}
        </span>
      )}
    </div>
  );
}
