'use client';

import { useState, useSyncExternalStore } from 'react';
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

export default function NewPeople({ known = [] }: { known?: string[] }) {
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
        if (known.some((k) => k.toLowerCase() === key)) {
          setNote(`${name} is already in your people — tick them above.`);
          continue;
        }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {people.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p) => (
            <span key={p.name.toLowerCase()} style={{
              minHeight: 44, padding: '0 4px 0 14px', borderRadius: 999, display: 'flex',
              alignItems: 'center', gap: 4, fontSize: 'var(--step--1)', fontWeight: 600,
              background: 'var(--cat-indigo-ink)', color: '#fff',
            }}>
              <input type="hidden" name="newName" value={p.name} />
              <input type="hidden" name="newPhone" value={p.phone ?? ''} />
              {p.name}
              <button type="button" aria-label={`Remove ${p.name}`}
                onClick={() => { haptic('select'); setPeople((h) => h.filter((q) => q !== p)); }}
                style={{
                  width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'transparent', color: 'inherit',
                }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } }}
          placeholder="Someone new — type a name"
          aria-label="Add someone by name"
          maxLength={60}
          autoComplete="off"
          style={{
            flex: 1, minWidth: 0, minHeight: 48, padding: '0 14px', borderRadius: 13,
            background: 'var(--c-card)', border: '1px solid var(--c-border)',
            color: 'var(--c-ink)', fontSize: 'var(--step-0)',
          }}
        />
        <button type="button" onClick={addTyped} disabled={typed.trim().length < 2} className="cta" style={{
          minHeight: 48, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step--1)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-ink)', opacity: typed.trim().length < 2 ? 0.5 : 1,
        }}>Add</button>
        {book && (
          <button type="button" onClick={fromBook} className="cta" aria-label="Pick from contacts" style={{
            minHeight: 48, padding: '0 14px', borderRadius: 13, fontSize: 'var(--step--1)', fontWeight: 600,
            background: 'var(--c-sunk)', color: 'var(--c-ink)',
          }}>
            <Icon name="phone" size={17} strokeWidth={1.9} />
            Contacts
          </button>
        )}
      </div>
      {note && (
        <p role="status" style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          {note}
        </p>
      )}
    </div>
  );
}
