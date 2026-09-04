import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { actorOrNull, membersOf, openInvitesOf } from '@/db/queries';
import { householdsOf } from '@/db/membership';
import InviteForm from './InviteForm';
import MemberRow from './MemberRow';
import RevokeButton from './RevokeButton';
import PasswordCard from './PasswordCard';
import BooksSwitcher from './BooksSwitcher';

export const metadata = { title: 'Household · Quiet Ledger' };
export const dynamic = 'force-dynamic';

const LABEL = { owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer' } as const;
const WHAT = {
  owner: 'Everything a contributing member can do, plus inviting people, changing roles and removing them.',
  adult: 'Adds, edits and deletes entries, and sets budgets. Cannot change who is in the household.',
  viewer: 'Reads every entry, budget and chart. Cannot change anything.',
} as const;

export default async function Household() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const name = actor.household_name;
  const [members, invites, books] = await Promise.all([
    membersOf(actor.household_id),
    openInvitesOf(actor.household_id),
    householdsOf(actor.user_id),
  ]);
  const canManage = actor.role === 'owner';
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const live = invites.filter((i) => !i.expired);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
      <header className="el2" style={{
        background:
          'repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, rgba(0,0,0,0) 1px 26px),'
          + 'radial-gradient(130% 85% at 82% -12%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 62%),'
          + 'linear-gradient(150deg,#2C5063 0%,#233D4D 58%,#172B37 100%)',
        color: '#fff', borderRadius: '0 0 28px 28px', padding: '18px 20px 26px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <a href="/" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </a>
        <h1 className="t" style={{ margin: 0, fontSize: 27, letterSpacing: '-.018em' }}>{name}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.84)' }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
          {live.length > 0 && ` · ${live.length} invited`}
        </p>
      </header>

      <p style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, margin: '18px 18px 22px',
        padding: '13px 14px', borderRadius: 14, background: 'var(--cat-cyan)',
        color: 'var(--cat-cyan-ink)', fontSize: 13, lineHeight: 1.5,
      }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.9} strokeLinecap="round" style={{ flex: 'none', marginTop: 2 }} aria-hidden>
          <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
          <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
        </svg>
        <span>
          Everyone in a household sees every entry and every budget.
        </span>
      </p>

      <Head>Members</Head>
      <Card pad="0 16px">
        {members.map((m, i) => (
          <MemberRow
            key={m.id}
            member={m}
            canManage={canManage}
            origin={origin}
            isSelf={m.id === actor.user_id}
            last={i === members.length - 1}
          />
        ))}
      </Card>

      {canManage && <InviteForm origin={origin} />}

      <Head>Your households</Head>
      <BooksSwitcher books={books} canRename={canManage} />

      {invites.length > 0 && (
        <>
          <Head>Invited</Head>
          <Card pad="0 16px">
            {invites.map((iv, i) => (
              <div key={iv.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
                borderBottom: i === invites.length - 1 ? undefined : '1px solid var(--c-rule)',
              }}>
                <span style={{
                  width: 42, height: 42, flex: 'none', borderRadius: 999, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: iv.expired ? 'var(--c-danger-tint)' : 'var(--c-warn-tint)',
                  color: iv.expired ? 'var(--c-danger)' : 'var(--c-warn)',
                }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{
                    fontSize: 14.5, fontWeight: 600, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{iv.email}</span>
                  <span style={{
                    fontSize: 12.5, color: iv.expired ? 'var(--c-danger)' : 'var(--c-meta)',
                  }}>
                    {LABEL[iv.role]} · {iv.expired ? 'expired' : `expires ${when(iv.expires_at)}`}
                  </span>
                </span>
                {canManage && <RevokeButton id={iv.id} />}
              </div>
            ))}
          </Card>
        </>
      )}

      <Head>Your account</Head>
      <PasswordCard />

      <Head>What each role can do</Head>
      <Card pad="4px 16px">
        {(['owner', 'adult', 'viewer'] as const).map((r, i) => (
          <div key={r} style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 0',
            borderBottom: i === 2 ? undefined : '1px solid var(--c-rule)',
          }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{LABEL[r]}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>{WHAT[r]}</span>
          </div>
        ))}
      </Card>

      {!canManage && (
        <p style={{
          margin: '0 20px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
          textAlign: 'center',
        }}>
          Only an owner can invite or remove people.
        </p>
      )}
    </main>
  );
}

function when(d: Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, letterSpacing: '-.012em' }}>
        {children}
      </h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function Card({ children, pad }: { children: React.ReactNode; pad: string }) {
  return (
    <section className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: pad,
    }}>{children}</section>
  );
}
