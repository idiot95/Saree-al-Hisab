'use server';

import { revalidatePath } from 'next/cache';
import { rethrowControlFlow } from '@/lib/rethrow';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { resolveOwner, insertPhotos } from '@/db/holdings';
import { BILL_MAX_FILES, billFrom, billProblem, type Bill } from '@/lib/bills';
import { isCurrency } from '@/lib/money';
import { canWrite, dateProblem, fxQuantity, gramsToMg, parseRate, purityPermille } from '@/lib/holding-input';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/* Reachable by direct POST, so each one re-establishes who is asking and
   re-checks that every id belongs to their household. A viewer is stopped
   here, not by hiding a button. */
class Refused extends Error {}
async function mustWrite() {
  const actor = await currentActor();
  if (!canWrite(actor.role)) throw new Refused('Viewers cannot change holdings.');
  return actor;
}
/** Only our own refusal is worded for the person; anything else is not shown. */
const refusal = (e: unknown) =>
  e instanceof Refused ? e.message : 'Something went wrong. Try again.';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const today = async () => (await sql`select current_date::text as d`)[0].d as string;

/** The files in the form's `photo` fields, checked against the one rule for
 *  anything kept with a record (src/lib/bills.ts). A form with no file chosen
 *  still sends one empty, nameless part: that is no photo, not a refusal.
 *  A bad file is refused with its name, never silently dropped. */
async function readPhotos(fd: FormData): Promise<{ ok: true; photos: Bill[] } | { ok: false; error: string }> {
  const files = fd.getAll('photo').filter((f): f is File => typeof f !== 'string' && !(f.size === 0 && f.name === ''));
  if (fd.getAll('photo').some((f) => typeof f === 'string' && f !== '')) {
    return { ok: false, error: 'Only images and PDFs can be attached.' };
  }
  if (files.length > BILL_MAX_FILES) return { ok: false, error: 'Attach five photos at most at a time.' };
  const photos: Bill[] = [];
  for (const f of files) {
    const why = billProblem(f.type, f.size);
    if (why) return { ok: false, error: `${f.name.slice(0, 40) || 'That file'}: ${why}` };
    const bill = billFrom(f.name, f.type, Buffer.from(await f.arrayBuffer()));
    if (!bill) return { ok: false, error: `${f.name.slice(0, 40) || 'That file'} could not be attached.` };
    photos.push(bill);
  }
  return { ok: true, photos };
}

/** The database's own refusals (0110 triggers, 0035 checks) as sentences. */
function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? '';
  const pot = /Use an account for ([A-Z]{3})/.exec(m);
  if (pot) return `${pot[1]} is the currency of your books. Keep it in an account, not a pot.`;
  if (/holding_attachment_(size|mime)/.test(m)) return 'Photos must be images or PDFs under 2 MB.';
  if (/holding_attachment_/.test(m)) return 'That photo does not belong to this holding.';
  if (/owner must be a member/i.test(m)) return 'That person is not in this household.';
  return 'That could not be saved. Check the details and try again.';
}

export async function createHolding(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: refusal(e) }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const kind = text(fd, 'kind');
      const name = text(fd, 'name');
      if (kind !== 'fx_cash' && kind !== 'metal') return { ok: false, error: 'Choose foreign cash, gold or silver.' };
      if (name.length < 2) return { ok: false, error: 'Give it a name.' };
      if (name.length > 60) return { ok: false, error: 'Names are 60 characters at most.' };

      const owner = await resolveOwner(actor.household_id, fd.get('owner'));
      if (!owner.ok) return owner;

      const now = await today();
      const asOf = text(fd, 'asOf') || now;
      const late = dateProblem(asOf, now);
      if (late) return { ok: false, error: late };

      let currency: string | null = null, metal: string | null = null, purity: number | null = null, quantity: number;
      if (kind === 'fx_cash') {
        currency = text(fd, 'currency').toUpperCase();
        if (!isCurrency(currency)) return { ok: false, error: 'Choose a currency from the list.' };
        if (currency === actor.currency) {
          return { ok: false, error: `${currency} is the currency of your books. Keep it in an account, not a pot.` };
        }
        const q = fxQuantity(fd.get('quantity'), currency);
        if (!q.ok) return q;
        quantity = q.minor;
      } else {
        metal = text(fd, 'metal');
        if (metal !== 'gold' && metal !== 'silver') return { ok: false, error: 'Choose gold or silver.' };
        const p = purityPermille(metal, fd.get('purity'));
        if (!p.ok) return p;
        purity = p.permille;
        const g = gramsToMg(fd.get('quantity'));
        if (!g.ok) return g;
        quantity = g.mg;
      }

      const shots = await readPhotos(fd);
      if (!shots.ok) return shots;

      // The holding, its first figure and its photos, or none of them.
      await sql.begin(async (tx) => {
        const [h] = await tx`
          insert into holding (household_id, owner_user_id, kind, name, currency, metal, purity_permille)
          values (${actor.household_id}, ${owner.id}, ${kind}, ${name}, ${currency}, ${metal}, ${purity})
          returning id`;
        const [snap] = await tx`
          insert into holding_snapshot (holding_id, household_id, as_of, quantity, created_by)
          values (${h.id}, ${actor.household_id}, ${asOf}, ${quantity}, ${actor.user_id})
          returning id`;
        await insertPhotos(tx, actor.household_id, h.id, snap.id, actor.user_id, shots.photos);
      });

      revalidatePath('/worth');
      revalidatePath('/');
      return { ok: true, message: `${name} added.` };
    } catch (e) {
      rethrowControlFlow(e);
      return { ok: false, error: friendly(e) };
    }
  });
}

/* One figure per holding per day: saving again the same day replaces it. The
   quantity is the whole balance on that day, not a change to it. */
export async function updateSnapshot(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: refusal(e) }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const id = text(fd, 'id');
      const [h] = /^[0-9a-f-]{36}$/i.test(id)
        ? await sql`select id, kind, currency, name, archived_at from holding
                    where id = ${id} and household_id = ${actor.household_id}`
        : [];
      if (!h) return { ok: false, error: 'That is not one of your holdings.' };
      if (h.archived_at) return { ok: false, error: 'That holding is archived.' };

      const now = await today();
      const asOf = text(fd, 'asOf') || now;
      const late = dateProblem(asOf, now);
      if (late) return { ok: false, error: late };

      const q = h.kind === 'fx_cash' ? fxQuantity(fd.get('quantity'), h.currency) : gramsToMg(fd.get('quantity'));
      if (!q.ok) return q;
      const quantity = 'minor' in q ? q.minor : q.mg;

      const shots = await readPhotos(fd);
      if (!shots.ok) return shots;

      /* The figure and its photos together. Saving the day again keeps the
         same snapshot row (an update, not a new row), so the day's earlier
         photos stay attached to it. */
      await sql.begin(async (tx) => {
        const [snap] = await tx`
          insert into holding_snapshot (holding_id, household_id, as_of, quantity, created_by)
          values (${h.id}, ${actor.household_id}, ${asOf}, ${quantity}, ${actor.user_id})
          on conflict (holding_id, as_of)
          do update set quantity = excluded.quantity, created_by = excluded.created_by
          returning id`;
        await insertPhotos(tx, actor.household_id, h.id, snap.id, actor.user_id, shots.photos);
      });

      revalidatePath('/worth');
      revalidatePath('/');
      return { ok: true, message: `${h.name} updated.` };
    } catch (e) {
      rethrowControlFlow(e);
      return { ok: false, error: friendly(e) };
    }
  });
}

/* Photos added on their own: to the holding, or as evidence for one of its
   figures. Reachable by direct POST, so the holding must be this household's
   and the snapshot, when named, must be that holding's. */
export async function addHoldingPhotos(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: refusal(e) }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const id = text(fd, 'holdingId');
      const [h] = /^[0-9a-f-]{36}$/i.test(id)
        ? await sql`select id, name, archived_at from holding where id = ${id} and household_id = ${actor.household_id}`
        : [];
      if (!h) return { ok: false, error: 'That is not one of your holdings.' };
      if (h.archived_at) return { ok: false, error: 'That holding is archived.' };

      const sid = text(fd, 'snapshotId');
      let snapshotId: string | null = null;
      if (sid) {
        const [s] = /^[0-9a-f-]{36}$/i.test(sid)
          ? await sql`select id from holding_snapshot
                      where id = ${sid} and holding_id = ${h.id} and household_id = ${actor.household_id}`
          : [];
        if (!s) return { ok: false, error: 'That figure is not one of this holding\'s.' };
        snapshotId = s.id as string;
      }

      const shots = await readPhotos(fd);
      if (!shots.ok) return shots;
      if (shots.photos.length === 0) return { ok: false, error: 'Choose a photo or a PDF to attach.' };

      await sql.begin((tx) => insertPhotos(tx, actor.household_id, h.id, snapshotId, actor.user_id, shots.photos));

      revalidatePath('/worth');
      return { ok: true, message: shots.photos.length === 1 ? 'Photo attached.' : `${shots.photos.length} photos attached.` };
    } catch (e) {
      rethrowControlFlow(e);
      return { ok: false, error: friendly(e) };
    }
  });
}

/* Archived, never deleted: its snapshots stay, and it simply stops counting. */
export async function archiveHolding(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: refusal(e) }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const id = text(fd, 'id');
      const [h] = /^[0-9a-f-]{36}$/i.test(id)
        ? await sql`select archived_at from holding where id = ${id} and household_id = ${actor.household_id}`
        : [];
      if (!h) return { ok: false, error: 'That is not one of your holdings.' };
      if (h.archived_at) return { ok: false, error: 'That holding is archived.' };
      await sql`update holding set archived_at = now()
                where id = ${id} and household_id = ${actor.household_id} and archived_at is null`;
      revalidatePath('/worth');
      revalidatePath('/');
      return { ok: true, message: 'Archived. Its history is kept.' };
    } catch (e) {
      rethrowControlFlow(e);
      return { ok: false, error: friendly(e) };
    }
  });
}

/* A price of your own for one unit of `base` — a currency held in a pot, or a
   gram of pure gold (XAU) or silver (XAG) — in the household's currency. Owners
   and adults may set one; a viewer may not. The rate goes to numeric as the
   string it was typed as. */
export async function setRateOverride(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: refusal(e) }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const base = text(fd, 'base').toUpperCase();
      if (base !== 'XAU' && base !== 'XAG') {
        const [held] = isCurrency(base)
          ? await sql`select 1 from holding where household_id = ${actor.household_id}
                      and kind = 'fx_cash' and currency = ${base} and archived_at is null limit 1`
          : [];
        if (!held) return { ok: false, error: 'You can set a rate for a currency you hold, or for gold or silver.' };
      }
      const rate = parseRate(fd.get('rate'));
      if (!rate.ok) return rate;

      const now = await today();
      const asOf = text(fd, 'asOf') || now;
      const late = dateProblem(asOf, now);
      if (late) return { ok: false, error: late };

      await sql`
        insert into price_override (household_id, base, quote, as_of, rate, set_by)
        values (${actor.household_id}, ${base}, ${actor.currency}, ${asOf}, ${rate.rate}, ${actor.user_id})
        on conflict (household_id, base, quote, as_of)
        do update set rate = excluded.rate, set_by = excluded.set_by, set_at = now()`;

      revalidatePath('/worth');
      revalidatePath('/');
      return { ok: true, message: 'Rate saved.' };
    } catch (e) {
      rethrowControlFlow(e);
      return { ok: false, error: friendly(e) };
    }
  });
}
