import { headers } from 'next/headers';
import { EmptyLine } from '../../entries/parts';
import { redirect } from 'next/navigation';
import { actorOrNull, captureTokensFor } from '@/db/queries';
import PageHead, { Label } from '../../PageHead';
import Screen from '../../Screen';
import TabBar from '../../TabBar';
import { TAB_BAR_SPACE } from '../../tabs';
import { Icon } from '../../Icon';
import AddPhone from './AddPhone';
import PhoneRow from './PhoneRow';
import Guides from './Guides';
import { captureOrigin } from '@/lib/capture-origin';

export const metadata = { title: 'SMS capture · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/** Where a phone should send its messages, and whether that address is a preview's that will go away
 *  (lib/capture-origin.ts): AUTH_URL when set, else this request's host. */
async function origin() {
  const h = await headers();
  return captureOrigin({
    authUrl: process.env.AUTH_URL,
    host: h.get('host'),
    forwardedProto: h.get('x-forwarded-proto'),
    productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelEnv: process.env.VERCEL_ENV,
  });
}

const day = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/* Household → SMS capture. A phone forwards the bank's messages to this app with a key of its own; each arrives as
   a draft under To review, and nothing is recorded until someone saves it. One key per phone, so losing one phone
   means revoking one key. Everyone sees and revokes their own; an owner sees everyone's and may revoke any. */
export default async function Capture() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const owner = actor.role === 'owner';
  const canAdd = actor.role !== 'viewer';
  const tokens = await captureTokensFor(actor.household_id, actor.user_id, owner);
  const where = await origin();
  const endpoint = `${where.origin}/api/capture/sms`;

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/household" title="SMS capture" sub="Bank messages become drafts to review" />
        <div className="flex flex-col gap-6 px-[var(--gutter)]">
          <ul className="flex list-none flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
            <li className="flex items-start gap-2.5">
              <Icon name="rule" size={18} className="mt-0.5 text-muted-foreground" />
              <span>Each message is a draft under To review. Nothing is recorded until you save it.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Icon name="lock" size={18} className="mt-0.5 text-muted-foreground" />
              <span>One-time passwords are never stored. The text of a message is deleted once it is handled, or after 30 days.</span>
            </li>
          </ul>

          <section aria-label="Your phones" className="flex flex-col gap-2">
            <Label>{owner ? 'Phones in this household' : 'Your phones'}</Label>
            {tokens.length === 0 ? (
              <EmptyLine icon="phone_iphone" className="rounded-2xl border border-dashed border-border">
                No phone is set up yet.{canAdd && ' Add one below, and its bank messages arrive as drafts.'}
              </EmptyLine>
            ) : (
              <div className="rounded-2xl border border-border bg-card px-4">
                {tokens.map((t, i) => {
                  const mine = t.user_id === actor.user_id;
                  return (
                    <PhoneRow key={t.id} id={t.id} label={t.label} who={mine ? null : t.who}
                      created={day(t.created_at)} used={t.last_used_at ? day(t.last_used_at) : null}
                      canRevoke={mine || owner} last={i === tokens.length - 1} />
                  );
                })}
              </div>
            )}
          </section>

          {where.preview && (
            /* A preview's address goes when the preview does: say so before a phone is set up against it. */
            <p data-preview-warning className="flex items-start gap-2.5 rounded-2xl bg-attention-soft p-4 text-sm leading-relaxed text-attention-soft-foreground">
              <Icon name="warning" size={18} className="mt-0.5" />
              <span><strong className="font-semibold">Preview address.</strong> This is a preview deploy, so the address below stops working when the preview goes away, and a phone set up with a key made here stops with it. Set phones up on the app’s main address.</span>
            </p>
          )}

          {canAdd ? (
            <section aria-label="Add a phone" className="flex flex-col gap-2">
              <Label>Add a phone</Label>
              <AddPhone endpoint={endpoint} />
            </section>
          ) : (
            <p className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
              <Icon name="info" size={18} className="mt-0.5" /> Viewers cannot add phones. An owner or contributing member can.
            </p>
          )}

          <section aria-label="How to set it up" className="flex flex-col gap-2">
            <Label>How to set it up</Label>
            <Guides endpoint={endpoint} />
          </section>
        </div>
        <TabBar current="/household" />
      </main>
    </Screen>
  );
}
