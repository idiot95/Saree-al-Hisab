import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, householdName } from '@/db/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const name = await householdName(actor.household_id);
  const role = actor.role === 'owner' ? 'owner'
    : actor.role === 'viewer' ? 'viewer' : 'contributing member';

  return (
    <main style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 999, background: 'var(--c-seagrass)',
          color: 'var(--c-on-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, flex: 'none',
        }}>
          {(actor.user_name || '?').slice(0, 2).toUpperCase()}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600 }}>{actor.user_name}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--c-meta)' }}>
            {name} · {role}
          </span>
        </span>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button type="submit" style={{
            minHeight: 44, padding: '0 14px', borderRadius: 12, background: 'var(--c-sunk)',
            color: 'var(--c-meta)', fontSize: 13.5, fontWeight: 600,
          }}>Sign out</button>
        </form>
      </div>

      <h1 className="t" style={{ margin: 0, fontSize: 30 }}>Quiet Ledger</h1>
      <p style={{ margin: 0, color: 'var(--c-meta)', lineHeight: 1.5 }}>
        Books open, columns ruled, nothing in them yet. That last part is on you.
      </p>
      <Link href="/add" style={{
        minHeight: 58, borderRadius: 16, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 9, fontSize: 16.5, fontWeight: 600, color: '#fff',
        textDecoration: 'none',
        background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
          + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
      }}>Own up to something</Link>
      <Link href="/household" style={{
        minHeight: 52, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', textDecoration: 'none', background: 'var(--c-card)',
        border: '1px solid var(--c-border)', color: 'var(--c-ink)', fontSize: 15.5, fontWeight: 600,
      }}>
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" />
          <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17 14.2a6 6 0 0 1 4 5.3" />
        </svg>
        Who else is in here
      </Link>
    </main>
  );
}
