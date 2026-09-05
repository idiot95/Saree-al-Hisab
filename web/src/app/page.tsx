import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, budgetFor, monthTotals, peopleFor, setupProgress } from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { HEADER_BG } from './auth-ui';
import TabBar, { TAB_BAR_SPACE } from './TabBar';
import GettingStarted from './GettingStarted';
import MonthSoFar from './MonthSoFar';

export const dynamic = 'force-dynamic';

const ROLE = { owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer' } as const;

export default async function Home() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const name = actor.household_name;
  const month = monthKey(new Date());
  const [progress, totals, rows, people] = await Promise.all([
    setupProgress(actor.household_id),
    monthTotals(actor.household_id, month),
    budgetFor(actor.household_id, month),
    peopleFor(actor.household_id),
  ]);
  const lent = people.reduce((n, p) => n + Number(p.balance), 0);
  const budget = Number(totals.budget);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
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
        <GettingStarted progress={{ ...progress, budget }} />

        {budget > 0 && (
          <MonthSoFar month={month} rows={rows} budget={budget} spent={Number(totals.spent)} />
        )}

        {/* Hick's Law: the tab bar already offers Add, Budget, Accounts and
            Household on every screen, so repeating them here is only more to
            read past. Home shows what only home can show, plus one quiet way
            back to the explanation. */}
        <Link href="/people" className="el" style={{
          minHeight: 58, borderRadius: 15, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', textDecoration: 'none', background: 'var(--c-card)',
          border: '1px solid var(--c-border)', color: 'var(--c-ink)',
        }}>
          <span style={{
            width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 9.5h10M7 14.5h6" /><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Lending</span>
          {lent !== 0 && (
            <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
              {format(Math.abs(lent))} {lent > 0 ? 'owed to you' : 'you owe'}
            </span>
          )}
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-off)"
            strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </Link>

        <Link href="/household" className="el" style={{
          minHeight: 58, borderRadius: 15, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', textDecoration: 'none', background: 'var(--c-card)',
          border: '1px solid var(--c-border)', color: 'var(--c-ink)',
        }}>
          <span style={{
            width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" />
              <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17 14.2a6 6 0 0 1 4 5.3" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Household</span>
          <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
            {progress.members} {progress.members === 1 ? 'member' : 'members'}
          </span>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-off)"
            strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </Link>

        <Link href="/guide" className="el" style={{
          minHeight: 58, borderRadius: 15, display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', textDecoration: 'none', background: 'var(--c-card)',
          border: '1px solid var(--c-border)', color: 'var(--c-ink)',
        }}>
          <span style={{
            width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="8.6" />
              <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.5" />
              <path d="M12 16.6v.1" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>How it works</span>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-off)"
            strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>
      <TabBar current="/" />
    </main>
  );
}

