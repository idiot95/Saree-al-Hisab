import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, membersOf, openInvitesOf, scanningState } from '@/db/queries';
import { householdsOf } from '@/db/membership';
import InviteForm from './InviteForm';
import MemberRow from './MemberRow';
import RevokeButton from './RevokeButton';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import PasswordCard from './PasswordCard';
import ScanKey from './ScanKey';
import ThemePicker from './ThemePicker';
import { forcedTheme, THEME_COOKIE } from '@/lib/theme';
import { headerBg } from '../auth-ui';
import BooksSwitcher from './BooksSwitcher';
import Screen from '../Screen';
import SwipeBack from '../SwipeBack';

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
  const [members, invites, books, scanning] = await Promise.all([
    membersOf(actor.household_id),
    openInvitesOf(actor.household_id),
    householdsOf(actor.user_id),
    scanningState(actor.household_id),
  ]);
  const canManage = actor.role === 'owner';
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const live = invites.filter((i) => !i.expired);
  const theme = forcedTheme((await cookies()).get(THEME_COOKIE)?.value) ?? 'system';

  return (
    <Screen>
      <SwipeBack to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('slate'),
          color: '#fff', borderRadius: '0 0 28px 28px', padding: '18px var(--gutter) 26px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <Link href="/" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>{name}</h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.84)' }}>
            Household &amp; settings · {members.length} {members.length === 1 ? 'member' : 'members'}
            {live.length > 0 && ` · ${live.length} invited`}
          </p>
        </header>

        <p style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, margin: '18px 18px 22px',
          padding: '13px var(--gutter)', borderRadius: 14, background: 'var(--cat-cyan)',
          color: 'var(--cat-cyan-ink)', fontSize: 'var(--step--1)', lineHeight: 1.5,
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
                      fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{iv.email}</span>
                    <span style={{
                      fontSize: 'var(--step--1)', color: iv.expired ? 'var(--c-danger)' : 'var(--c-meta)',
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

        {canManage && (
          <>
            <Head>Scanning receipts</Head>
            <ScanKey hasKey={scanning.has_key} setOn={scanning.set_on} />
          </>
        )}

        <Head>Appearance</Head>
        <ThemePicker current={theme} />

        <Head>Your account</Head>
        <PasswordCard />
        {/* Signing out lives here, with the rest of the account — not on the
            Home header, where it was the only button and the wrong one to
            press by accident with a thumb. */}
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}
          className="el card" style={{ margin: '-8px var(--gutter) 22px', borderRadius: 18 }}>
          <button type="submit" className="press" style={{
            width: '100%', minHeight: 56, padding: '0 var(--pad)', borderRadius: 18,
            display: 'flex', alignItems: 'center', gap: 11, background: 'var(--c-card)',
          }}>
            <span style={{
              width: 38, height: 38, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 16.5 19.5 12 15 7.5" /><path d="M19 12H9" />
                <path d="M12 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H12" />
              </svg>
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>Sign out</span>
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>On this phone only</span>
            </span>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-meta)"
              strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </form>

        <Head>What each role can do</Head>
        <Card pad="4px 16px">
          {(['owner', 'adult', 'viewer'] as const).map((r, i) => (
            <div key={r} style={{
              display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 0',
              borderBottom: i === 2 ? undefined : '1px solid var(--c-rule)',
            }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{LABEL[r]}</span>
              <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>{WHAT[r]}</span>
            </div>
          ))}
        </Card>

        {!canManage && (
          <p style={{
            margin: '0 var(--gutter)', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
            textAlign: 'center',
          }}>
            Only an owner can invite or remove people.
          </p>
        )}
        <TabBar current="/household" />
      </main>
    </Screen>
  );
}

function when(d: Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px var(--gutter) 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
        {children}
      </h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}

function Card({ children, pad }: { children: React.ReactNode; pad: string }) {
  return (
    <section className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: pad,
    }}>{children}</section>
  );
}
