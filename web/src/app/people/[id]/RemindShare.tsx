'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" onClick={go} disabled={busy} className="h-11 rounded-xl text-body font-semibold">
        <Icon name="bell" size={16} />
        {busy ? 'Preparing…' : bills.length > 0 ? `Remind · ${bills.length} bill${bills.length === 1 ? '' : 's'}` : 'Remind'}
      </Button>
      {said && <span role="status" className="text-footnote leading-snug text-muted-foreground">{said}</span>}
    </div>
  );
}
