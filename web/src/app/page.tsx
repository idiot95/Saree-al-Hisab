import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, setupProgress } from '@/db/queries';
import { HEADER_BG } from './auth-ui';
import GettingStarted from './GettingStarted';

export const dynamic = 'force-dynamic';

const ROLE = { owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer' } as const;

export default async function Home() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const name = actor.household_name;
  const progress = await setupProgress(actor.household_id);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '20px 20px 26px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          width: 42, height: 42, flex: 'none', borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
          background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)',
        }}>{(actor.user_name || '?').slice(0, 2).toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 16, fontWeight: 600, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name}</span>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)' }}>
            {actor.user_name} · {actor.role ? ROLE[actor.role] : ''}
          </span>
        </span>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button type="submit" style={{
            minHeight: 44, padding: '0 13px', borderRadius: 11, fontSize: 13.5, fontWeight: 600,
            background: 'rgba(255,255,255,.14)', color: '#fff',
          }}>Sign out</button>
        </form>
      </header>

      <div style={{ padding: '20px 18px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GettingStarted progress={progress} />

        <Link href="/add" className="el2" style={{
          minHeight: 62, borderRadius: 16, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 10, fontSize: 17, fontWeight: 600, color: '#fff',
          textDecoration: 'none',
          background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
            + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          New entry
        </Link>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Tile href="/accounts" title="Accounts"
            sub={`${progress.accounts} ${progress.accounts === 1 ? 'account' : 'accounts'} · ${progress.methods} ${progress.methods === 1 ? 'payment method' : 'payment methods'}`}
            d="M3.5 9.5h17M4.5 6.5h15a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6h-15a1.6 1.6 0 0 1-1.6-1.6V8.1a1.6 1.6 0 0 1 1.6-1.6z" />
          <Tile href="/household" title="Household"
            sub={`${progress.members} ${progress.members === 1 ? 'member' : 'members'}`}
            d="M9 11.7a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19.5a6 6 0 0 1 12 0M16 5.6a3.2 3.2 0 0 1 0 5.8M17 14.2a6 6 0 0 1 4 5.3" />
          <Tile href="/guide" title="How it works"
            sub="A short walkthrough of the app"
            d="M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5M12 16.6v.1" />
        </nav>
      </div>
    </main>
  );
}

function Tile({ href, title, sub, d }: { href: string; title: string; sub: string; d: string }) {
  return (
    <Link href={href} className="el" style={{
      minHeight: 66, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 13,
      padding: '0 16px', textDecoration: 'none', background: 'var(--c-card)',
      border: '1px solid var(--c-border)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-sunk)', color: 'var(--c-meta)',
      }}>
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={d} />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>{sub}</span>
      </span>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-off)"
        strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}
