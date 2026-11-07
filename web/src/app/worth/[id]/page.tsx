import { notFound, redirect } from 'next/navigation';
import { EmptyLine } from '../../entries/parts';
import { liRule } from '../../form-bits';
import { actorOrNull, membersOf } from '@/db/queries';
import { baseOf, holdingById, photosFor, snapshotsFor } from '@/db/holdings';
import { ensureRates } from '@/db/prices';
import { withHousehold } from '@/db/client';
import { format, symbolOf, unitOf } from '@/lib/money';
import { dayLabel, gramsLabel, purityLabel, rateLabel } from '@/lib/holding-input';
import BackLink from '../../BackLink';
import Back from '../../Back';
import Screen from '../../Screen';
import { BACK_SPACE } from '../../tabs';
import { Icon } from '../../Icon';
import { Figure } from '../../Figure';
import { UpdateBalance, RateLine, AddPhotos, ArchiveHolding } from './HoldingActions';

export const metadata = { title: 'Holding · Wealth · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const longDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/* One holding: what it is worth, the rate that says so (tap to put your own), every figure ever saved for it
   with the photos that back each one, and Update balance. Archive is last and asks twice. */
export default async function Holding({ params }: { params: Promise<{ id: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const hh = actor.household_id;
  const { id } = await params;

  const found = await holdingById(hh, id);
  if (!found) notFound();
  // The rate first, so the value read below is today's.
  const base = baseOf(found);
  const { stale } = found.archived_at ? { stale: [] as string[] } : await ensureRates(hh, [base], actor.currency);

  const [h, snapshots, photos, members] = await withHousehold(hh, () => Promise.all([
    holdingById(hh, id), snapshotsFor(hh, id), photosFor(hh, id), membersOf(hh),
  ]));
  if (!h) notFound();

  const fx = h.kind === 'fx_cash';
  const native = (q: string | number) => {
    const n = Number(q);
    return fx ? format(n, h.currency!, { paise: n % unitOf(h.currency!) !== 0 }) : `${gramsLabel(n)} g`;
  };
  const owner = members.find((m) => m.id === h.owner_user_id);
  const what = fx ? `${h.currency} pot` : `${purityLabel(h.metal, h.purity_permille)} ${h.metal}`;
  const canWrite = (actor.role === 'owner' || actor.role === 'adult') && !h.archived_at;
  const value = h.value_minor === null ? null : Number(h.value_minor);

  const subject = fx ? h.currency! : h.metal === 'gold' ? 'Gold' : 'Silver';
  const rate = h.rate
    ? `${fx ? `1 ${subject} = ` : `${subject} `}${symbolOf(actor.currency)}${rateLabel(h.rate)}${fx ? '' : '/g pure'} · ${dayLabel(h.rate_as_of)}${h.rate_source === 'override' ? ' · your rate' : ''}`
    : null;
  const staleLine = stale.includes(base)
    ? (h.rate_as_of && h.rate_source !== 'override' ? `Rate from ${dayLabel(h.rate_as_of)} — couldn’t update` : h.rate ? null : 'Couldn’t get a rate')
    : null;

  const forSnap = (sid: string) => photos.filter((p) => p.snapshot_id === sid);
  const own = photos.filter((p) => p.snapshot_id === null);

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: BACK_SPACE }}>
        <Back to="/worth" />
        <header className="flex flex-col gap-2 px-[var(--gutter)] pb-3 pt-4">
          <BackLink to="/worth" />
          <p className="text-subhead text-muted-foreground">{fx ? 'Pots in other currencies' : 'Gold & silver'}</p>
          <h1 className="text-title-2 font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{h.name}</h1>
          {h.archived_at && (
            <p className="flex items-center gap-1.5 text-subhead text-muted-foreground"><Icon name="archive" size={17} />Archived. Its history is kept.</p>
          )}
        </header>

        <div className="flex flex-col gap-4 px-[var(--gutter)]">
          <section aria-label="What it is worth" className="flex flex-col gap-2 rounded-[22px] bg-hero p-4 text-hero-foreground">
            <span className="text-subhead text-hero-muted">{owner ? first(owner.name) : 'Joint'} · {what}</span>
            {value !== null
              ? <Figure minor={value} className="text-large-title font-bold leading-none tracking-tight tabular-nums" />
              : (
                <span className="flex flex-col gap-1">
                  <span className="text-large-title font-bold leading-none tabular-nums">{h.quantity ? native(h.quantity) : '—'}</span>
                  <span className="flex items-center gap-1.5 text-body text-hero-muted"><Icon name="info" size={17} />Not valued yet</span>
                </span>
              )}
            {value !== null && h.quantity && <span className="text-body text-hero-muted">{native(h.quantity)}{h.as_of ? ` on ${dayLabel(h.as_of)}` : ''}</span>}
          </section>

          <RateLine base={base} subject={subject} rate={rate} stale={staleLine} canWrite={canWrite} fx={fx} />

          {canWrite && (
            <div className="flex gap-2">
              <UpdateBalance id={h.id} fx={fx} currency={h.currency} />
              <AddPhotos holdingId={h.id} />
            </div>
          )}

          <section aria-label="History" className="flex flex-col gap-1.5">
            <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">History</h2>
            <ol className="overflow-hidden rounded-[20px] bg-card shadow-card">
              {snapshots.map((s) => (
                <li key={s.id} className={`flex flex-col gap-2 px-3.5 py-3 ${liRule} [--rule-x:14px]`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-body">{longDay(s.as_of)}</span>
                    <span className="text-body font-semibold tabular-nums">{native(s.quantity)}</span>
                  </span>
                  {forSnap(s.id).length > 0 && <Thumbs photos={forSnap(s.id)} />}
                </li>
              ))}
              {snapshots.length === 0 && <li><EmptyLine icon="schedule" className="">No figures yet.</EmptyLine></li>}
            </ol>
          </section>

          {own.length > 0 && (
            <section aria-label="Photos" className="flex flex-col gap-1.5">
              <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">Photos</h2>
              <div className="rounded-[20px] bg-card shadow-card p-3.5"><Thumbs photos={own} /></div>
            </section>
          )}

          {canWrite && <ArchiveHolding id={h.id} name={h.name} />}
        </div>
      </main>
    </Screen>
  );
}

/* A photo is its own thumbnail; a PDF is its icon and name. Both open the file itself, served on its own with a
   sandboxing policy by /attachment/h/[id]. */
function Thumbs({ photos }: { photos: { id: string; name: string; mime: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <li key={p.id}>
          <a href={`/attachment/h/${p.id}`} target="_blank" rel="noopener" aria-label={`Open ${p.name}`}
            className="block overflow-hidden rounded-xl border border-border">
            {p.mime === 'application/pdf' ? (
              <span className="flex size-16 flex-col items-center justify-center gap-0.5 bg-muted text-muted-foreground">
                <Icon name="picture_as_pdf" size={24} /><span className="text-caption font-medium">PDF</span>
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a private, per-household file; next/image would cache it
              <img src={`/attachment/h/${p.id}`} alt={p.name} width={64} height={64} loading="lazy" className="size-16 object-cover" />
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
