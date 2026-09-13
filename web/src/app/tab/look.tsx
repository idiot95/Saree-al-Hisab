import { tintOf } from '../Icon';

/* How a tab and the people on it are drawn, shared by the Loan centre, a
   tab's own screen, Home and Trends. No hooks, so a server page can use it.

   A tab has no colour of its own in the books — nobody should have to pick
   one to open a tab — so it wears one worked out from its id: the same tab is
   the same colour on every screen, and neighbours are unlikely to match. */

const TINTS = ['cyan', 'purple', 'orange', 'blue', 'green', 'pink', 'rust', 'indigo'] as const;

export function tabTint(id: string): (typeof TINTS)[number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?';

/** One person's initials in their own tint. */
export function Face({ name, tint, size = 40, ring }: {
  name: string; tint: string; size?: number; ring?: string;
}) {
  const [bg, ink] = tintOf(tint);
  return (
    <span aria-hidden style={{
      width: size, height: size, flex: 'none', borderRadius: 999, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: bg, color: ink,
      fontSize: size >= 34 ? 'var(--step--1)' : 10, fontWeight: 700,
      boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
    }}>{initials(name)}</span>
  );
}

/** The people on a tab as overlapping faces — or, with nobody on it, an empty
 *  dashed circle that says so in words as well. */
export function Faces({ people, size = 22, max = 4 }: {
  people: { id: string; name: string; tint: string }[]; size?: number; max?: number;
}) {
  if (people.length === 0) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
        <span aria-hidden style={{
          width: size, height: size, flex: 'none', borderRadius: 999, border: '1.5px dashed var(--c-dash)',
        }} />
        No one named
      </span>
    );
  }
  const shown = people.slice(0, max);
  return (
    <span aria-label={people.map((p) => p.name).join(', ')} style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <span key={p.id} style={{ display: 'flex', marginLeft: i ? -6 : 0 }}>
          <Face name={p.name} tint={p.tint} size={size} ring="var(--c-card)" />
        </span>
      ))}
      {people.length > max && (
        <span style={{ marginLeft: 5, fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
          +{people.length - max}
        </span>
      )}
    </span>
  );
}
