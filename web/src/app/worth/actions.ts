'use server';

import { revalidatePath } from 'next/cache';
import { rethrowControlFlow } from '@/lib/rethrow';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { resolveOwner } from '@/db/holdings';
import { isCurrency } from '@/lib/money';
import { dateProblem, fxQuantity, gramsToMg, parseRate, purityPermille } from '@/lib/holding-input';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/* Reachable by direct POST, so each one re-establishes who is asking and
   re-checks that every id belongs to their household. A viewer is stopped
   here, not by hiding a button. */
async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change holdings.');
  return actor;
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const today = async () => (await sql`select current_date::text as d`)[0].d as string;

/** The database's own refusals (0110 triggers, 0035 checks) as sentences. */
function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? '';
  const pot = /Use an account for ([A-Z]{3})/.exec(m);
  if (pot) return `${pot[1]} is the currency of your books. Keep it in an account, not a pot.`;
  if (/owner must be a member/i.test(m)) return 'That person is not in this household.';
  return 'That could not be saved. Check the details and try again.';
}

export async function createHolding(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
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

      // The holding and its first figure, or neither.
      await sql.begin(async (tx) => {
        const [h] = await tx`
          insert into holding (household_id, owner_user_id, kind, name, currency, metal, purity_permille)
          values (${actor.household_id}, ${owner.id}, ${kind}, ${name}, ${currency}, ${metal}, ${purity})
          returning id`;
        await tx`
          insert into holding_snapshot (holding_id, household_id, as_of, quantity, created_by)
          values (${h.id}, ${actor.household_id}, ${asOf}, ${quantity}, ${actor.user_id})`;
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
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const id = text(fd, 'id');
      const [h] = /^[0-9a-f-]{36}$/i.test(id)
        ? await sql`select id, kind, currency, name from holding
                    where id = ${id} and household_id = ${actor.household_id} and archived_at is null`
        : [];
      if (!h) return { ok: false, error: 'That is not one of your holdings.' };

      const now = await today();
      const asOf = text(fd, 'asOf') || now;
      const late = dateProblem(asOf, now);
      if (late) return { ok: false, error: late };

      const q = h.kind === 'fx_cash' ? fxQuantity(fd.get('quantity'), h.currency) : gramsToMg(fd.get('quantity'));
      if (!q.ok) return q;
      const quantity = 'minor' in q ? q.minor : q.mg;

      await sql`
        insert into holding_snapshot (holding_id, household_id, as_of, quantity, created_by)
        values (${h.id}, ${actor.household_id}, ${asOf}, ${quantity}, ${actor.user_id})
        on conflict (holding_id, as_of)
        do update set quantity = excluded.quantity, created_by = excluded.created_by`;

      revalidatePath('/worth');
      revalidatePath('/');
      return { ok: true, message: `${h.name} updated.` };
    } catch (e) {
      rethrowControlFlow(e);
      return { ok: false, error: friendly(e) };
    }
  });
}

/* Archived, never deleted: its snapshots stay, and it simply stops counting. */
export async function archiveHolding(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    try {
      const id = text(fd, 'id');
      const rows = /^[0-9a-f-]{36}$/i.test(id)
        ? await sql`update holding set archived_at = now()
                    where id = ${id} and household_id = ${actor.household_id} and archived_at is null
                    returning name`
        : [];
      if (!rows.length) return { ok: false, error: 'That is not one of your holdings.' };
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
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
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
