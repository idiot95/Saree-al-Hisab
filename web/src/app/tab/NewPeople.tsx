'use client';

import { useState, useSyncExternalStore } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '../Icon';
import { haptic } from '../haptics';

/* People who are not in the khata yet, named right here on the form rather
   than on a detour through /people. Each one becomes a chip and a pair of
   hidden fields; the action finds or creates them inside the same transaction
   as whatever they are being added to.

   The phone's own address book is offered where the browser has it. That is
   Chrome on Android, and nothing on an iPhone — Safari has no Contact Picker
   API, so an installed copy on iOS never sees the button. Typing is the path
   that works everywhere; the picker is a shortcut, not a dependency, and it is
   only shown after mount so the server and the phone agree on the first
   paint. Nothing from the address book leaves the form except the name and
   number that end up as a person. */

type Picked = { name: string; phone: string | null };

type ContactsApi = {
  select: (props: string[], opts?: { multiple?: boolean }) =>
    Promise<{ name?: string[]; tel?: string[] }[]>;
};

/* Whether this browser has the picker. Read as an external store rather than
   set in an effect: the server snapshot is "no", so the first paint on the
   phone matches the HTML it was sent, and the real answer takes over from
   the first client render. */
const hasBook = () => typeof navigator !== 'undefined' && 'contacts' in navigator
  && typeof (navigator as unknown as { contacts?: ContactsApi }).contacts?.select === 'function';
const noop = () => () => {};

export default function NewPeople() {
  const [typed, setTyped] = useState('');
  const [people, setPeople] = useState<Picked[]>([]);
  const book = useSyncExternalStore(noop, hasBook, () => false);
  const [note, setNote] = useState<string | null>(null);

  function add(list: Picked[]) {
    setNote(null);
    setPeople((have) => {
      const out = [...have];
      for (const p of list) {
        const name = p.name.trim().replace(/\s+/g, ' ');
        if (name.length < 2) continue;
        const key = name.toLowerCase();
        if (out.some((q) => q.name.toLowerCase() === key)) continue;
        out.push({ name, phone: p.phone });
      }
      return out;
    });
  }

  function addTyped() {
    if (typed.trim().length < 2) return;
    haptic('select');
    add([{ name: typed, phone: null }]);
    setTyped('');
  }

  async function fromBook() {
    haptic('select');
    try {
      const api = (navigator as unknown as { contacts: ContactsApi }).contacts;
      const got = await api.select(['name', 'tel'], { multiple: true });
      add(got.map((c) => ({ name: c.name?.[0] ?? '', phone: c.tel?.[0] ?? null })));
    } catch {
      /* Dismissed, or refused. Either way the form is exactly as it was. */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {people.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <span key={p.name.toLowerCase()}
              className="flex min-h-11 items-center gap-1 rounded-full bg-primary pl-3.5 pr-0.5 text-body font-semibold text-primary-foreground">
              <input type="hidden" name="newName" value={p.name} />
              <input type="hidden" name="newPhone" value={p.phone ?? ''} />
              {p.name}
              <button type="button" aria-label={`Remove ${p.name}`}
                onClick={() => { haptic('select'); setPeople((h) => h.filter((q) => q !== p)); }}
                className="grid size-10 place-items-center rounded-full">
                <Icon name="close" size={16} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }}
          placeholder="Type a name"
          aria-label="Add someone by name"
          maxLength={60}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl bg-card px-3.5 text-[length:var(--field)]"
        />
        <Button type="button" variant="secondary" onClick={addTyped} disabled={typed.trim().length < 2}
          className="h-12 rounded-xl px-4 font-semibold">Add</Button>
        {book && (
          <Button type="button" variant="secondary" onClick={fromBook} aria-label="Pick from contacts"
            className="h-12 rounded-xl px-3.5 font-semibold">
            <Icon name="phone" size={17} />
            Contacts
          </Button>
        )}
      </div>
      {note && <p role="status" className="text-footnote leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}
