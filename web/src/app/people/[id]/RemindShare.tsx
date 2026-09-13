'use client';

import { useState } from 'react';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import { reminderText, shareReminder, type ReminderBill } from '../../remind';

/* Asking one person for one claim back, from their own page. The sharing —
   the share sheet, the bills riding along where the phone can carry them,
   the clipboard as a last resort — lives in ../../remind.ts, which the tab
   screen's reminders use too, so the two read and behave alike. */

export type Bill = ReminderBill;

export default function RemindShare({ person, what, amount, on, bills }: {
  person: string; what: string; amount: string; on: string; bills: Bill[];
}) {
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true); setSaid(null);
    haptic('select');
    setSaid(await shareReminder(reminderText({ person, amount, what, on }), bills));
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <button type="button" onClick={go} disabled={busy} style={{
        minHeight: 44, padding: '0 13px', borderRadius: 11, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 7,
        fontSize: 'var(--step--2)', fontWeight: 700,
        background: 'var(--c-sunk)', color: 'var(--c-ink)',
      }}>
        <Icon name="bell" size={15} strokeWidth={2} />
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
