/* Asking for money back, without the app deciding how.

   A reminder goes wherever the household already talks — WhatsApp, a message,
   email — so this hands the sentence to the phone's own share sheet rather
   than sending anything itself. Nothing leaves the device until a person picks
   who it goes to.

   Where the phone can share files, the bills go with it, because "which
   flight?" is the next question after "you owe me 4,500". Where it cannot —
   most desktops, some browsers — the text goes on its own and says so rather
   than silently dropping the evidence. Clipboard is the last fallback.

   Client only: navigator.share needs the tap that called it, so call this
   straight from a click handler. */

export type ReminderBill = { id: string; name: string; mime: string };

/** Shares the reminder. Resolves to a line worth showing, or null when there
 *  is nothing to say (it went, or the share sheet was dismissed). */
export async function shareReminder(text: string, bills: ReminderBill[] = []): Promise<string | null> {
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
      return bills.length > 0 && !withFiles
        ? 'Sent without the bills — this phone will not share files.'
        : null;
    }
    await navigator.clipboard.writeText(text);
    return 'Copied. Paste it wherever you like.';
  } catch (e) {
    // A cancelled share sheet is not a failure and must not look like one.
    if ((e as Error)?.name === 'AbortError') return null;
    try {
      await navigator.clipboard.writeText(text);
      return 'Copied. Paste it wherever you like.';
    } catch { return 'Could not share from this browser.'; }
  }
}

/** "a reminder about ₹9,200 for Flight — Emirates on 26 Aug 2026" — the one
 *  sentence every reminder is built from, so they all read alike. */
export function reminderText({ person, amount, what, on, tab }: {
  person: string | null; amount: string; what: string; on?: string | null; tab?: string | null;
}): string {
  const day = on
    ? new Date(`${on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const lead = person ? `${person}, a reminder` : 'A reminder';
  const where = tab && tab !== what ? `, from ${tab}` : '';
  return `${lead} about ${amount} for ${what}${day ? ` on ${day}` : ''}${where}.`;
}
