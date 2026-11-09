import Link from '@/app/NavLink';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, entryCount, membersOf, openInvitesOf, scanningState } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { householdsOf } from '@/db/membership';
import InviteForm from './InviteForm';
import { passwordSignInOpenNow } from '@/lib/password-window';
import MemberRow from './MemberRow';
import RevokeButton from './RevokeButton';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import PasswordCard from './PasswordCard';
import LinkGoogle from './LinkGoogle';
import ScanKey from './ScanKey';
import ThemePicker from './ThemePicker';
import { forcedTheme, THEME_COOKIE } from '@/lib/theme';
import BooksSwitcher from './BooksSwitcher';
import PageHead from '../PageHead';
import Screen from '../Screen';
import { Icon } from '../Icon';
import SignOutEverywhere from './SignOutEverywhere';
import { Avatar, Card, Chevron, Glyph, row, Section, Words } from './rows';

export const metadata = { title: 'Household · Saree al-Hisab' };
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
  const hh = actor.household_id;
  const [members, invites, books, scanning, entries] = await withHousehold(hh, () => Promise.all([
    membersOf(hh),
    openInvitesOf(hh),
    householdsOf(actor.user_id),
    scanningState(hh),
    entryCount(hh),
  ]));
  const canManage = actor.role === 'owner';
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const live = invites.filter((i) => !i.expired);
  const theme = forcedTheme((await cookies()).get(THEME_COOKIE)?.value) ?? 'system';

  const me = members.find((m) => m.id === actor.user_id);

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/" title={name}
          sub={<>Household and settings · {members.length} {members.length === 1 ? 'member' : 'members'}
            {live.length > 0 && ` · ${live.length} invited`}</>} />

        <div className="flex flex-col gap-6 px-[var(--gutter)] pb-8">
          {/* The household first (ux-audit O11): the screen is opened from Home's "Household and settings", so the
              people, inviting more, the books and the household's tools lead, and the account — with its two ways
              out — comes last. */}
          <Section label="Members"
            note={<span className="flex items-start gap-1.5"><Icon name="lock" size={16} className="mt-px" />
              Everyone in a household sees every entry and every budget.{!canManage && ' Only an owner can invite or remove people.'}</span>}>
            <Card>
              {members.map((m) => (
                <MemberRow key={m.id} member={m} canManage={canManage} origin={origin} isSelf={m.id === actor.user_id} />
              ))}
              {/* What the three words mean, shut until asked: the same question comes up once, at invite time. */}
              <details className="group">
                <summary className={`${row} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                  <Glyph name="help" />
                  <Words title="What each role can do" />
                  <Icon name="expand_more" size={20} className="flex-none text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <dl className="flex flex-col gap-3 px-[var(--pad)] pb-4 pl-[calc(var(--pad)+50px)]">
                  {(['owner', 'adult', 'viewer'] as const).map((r) => (
                    <div key={r} className="flex flex-col gap-0.5">
                      <dt className="text-body font-semibold">{LABEL[r]}</dt>
                      <dd className="text-subhead leading-normal text-muted-foreground">{WHAT[r]}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </Card>
          </Section>

          {(canManage || invites.length > 0) && (
            <Section label={canManage ? 'Invite' : 'Invited'}>
              {canManage && <InviteForm origin={origin} household={name} inviter={actor.user_name} passwordOpen={passwordSignInOpenNow()} />}
              {invites.length > 0 && (
                <Card className={canManage ? 'mt-2' : ''}>
                  {invites.map((iv) => (
                    <div key={iv.id} className="flex min-h-16 items-center gap-3 px-[var(--pad)] py-2.5">
                      <Glyph name={iv.expired ? 'error' : 'schedule'} tone={iv.expired ? 'danger' : 'attention'} />
                      <Words title={iv.email}
                        sub={<span className={iv.expired ? 'font-semibold text-destructive' : ''}>
                          {LABEL[iv.role]} · {iv.expired ? 'Expired' : `Invited, expires ${when(iv.expires_at)}`}
                        </span>} />
                      {canManage && <RevokeButton id={iv.id} />}
                    </div>
                  ))}
                </Card>
              )}
            </Section>
          )}

          <Section label="Books">
            <BooksSwitcher books={books} canRename={canManage}
              currency={actor.currency} currencyFixed={entries > 0} />
          </Section>

          <Section label="Appearance">
            <ThemePicker current={theme} />
          </Section>

          {canManage && (
            <Section label="Scanning key">
              <ScanKey hasKey={scanning.has_key} setOn={scanning.set_on} />
            </Section>
          )}

          <Section label="SMS capture">
            <Card>
              <Link href="/household/capture" className={row}>
                <Glyph name="sms" />
                <Words title="SMS capture" sub="Bank messages from your phone, as drafts to review" />
                <Chevron />
              </Link>
            </Card>
          </Section>

          <Section label="Your account">
            <Card>
              <div className="flex min-h-16 items-center gap-3 px-[var(--pad)] py-3">
                <Avatar name={actor.user_name} image={me?.image ?? null} />
                <Words title={actor.user_name || 'You'}
                  sub={[actor.email, actor.role ? LABEL[actor.role] : null].filter(Boolean).join(' · ')} />
              </div>
              <LinkGoogle linked={!!me?.has_google} />
              <PasswordCard />
              <SignOutEverywhere />
              {/* Signing out lives here, with the rest of the account — not on the Home header, where it was the
                  only button and the wrong one to press by accident with a thumb. */}
              <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
                <button type="submit" className={row}>
                  <Glyph name="logout" />
                  <Words title="Sign out" sub="On this phone only" />
                  <Chevron />
                </button>
              </form>
              {/* The same page that sign-up points at, from inside: the terms are also the record of how the books
                  are kept, and that is a question people ask months later, when the household has grown. */}
              <Link href="/terms" className={row}>
                <Glyph name="verified_user" />
                <Words title="Terms, and how your data is kept" sub="Encrypted, checked on every request, source public" />
                <Chevron />
              </Link>
            </Card>
          </Section>
        </div>
        <TabBar current="/household" />
      </main>
    </Screen>
  );
}

function when(d: Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
