'use server';

import { sql, withHousehold } from '@/db/client';
import { currentActor, geminiKeyFor } from '@/db/queries';
import { scanReceipt, MAX_BYTES, ACCEPTED } from '@/db/gemini';
import { open as unseal } from '@/lib/secretbox';
import { whatIsMissing, type Scanned } from '@/lib/receipt';
import { tooMany, waitMessage } from '@/db/rate-limit';
import { rethrowControlFlow } from '@/lib/rethrow';

export type ScanResult =
  | { ok: true; scan: Scanned; missing: string[]; suggestedCategoryId: string | null }
  | { ok: false; error: string }
  | null;

/* A scan produces a DRAFT and nothing else. Nothing is written to the ledger
   here — the person reads what was found, corrects it, and saves it themselves
   on the ordinary Add Entry screen. A wrong figure posted silently is worse
   than no figure at all. */
export async function scan(_prev: ScanResult, fd: FormData): Promise<ScanResult> {
  let actor;
  try {
    actor = await currentActor();
    if (actor.role === 'viewer') return { ok: false, error: 'Viewers cannot add entries.' };
  } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  // Each scan costs the household's own quota, so the limit is per caller and
  // deliberately tight.
  const wait = await tooMany('scan', 20, 60 * 60);
  if (wait) return { ok: false, error: `That is a lot of scanning. ${waitMessage(wait)}` };

  const sealed = await geminiKeyFor(actor.household_id);
  if (!sealed) {
    return { ok: false, error: 'No scanning key yet. An owner can add one in Household.' };
  }
  const secret = process.env.AUTH_SECRET;
  const key = secret ? unseal(sealed, secret) : null;
  if (!key) return { ok: false, error: 'The stored key could not be read. Add it again.' };

  const file = fd.get('receipt');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a photo of the receipt first.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'That file is over 6 MB. A photo of the receipt is enough.' };
  }
  if (!(ACCEPTED as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'That has to be a photo (PNG, JPEG or WebP) or a PDF.' };
  }

  const out = await scanReceipt(key, Buffer.from(await file.arrayBuffer()), file.type);
  if (!out.ok) return { ok: false, error: out.error };

  /* The model's category is a hint in its own words, not one of ours. It is
     matched against the household's actual categories and dropped if it does
     not land on one — inventing a category from a scan would put spending
     somewhere nobody chose. */
  let suggestedCategoryId: string | null = null;
  if (out.scan.categoryHint) {
    // Scoped here and not around the whole action: the model takes seconds,
    // and a transaction should not sit open on a pooled connection for that.
    const hint = out.scan.categoryHint;
    suggestedCategoryId = await withHousehold(actor.household_id, async () => {
      const [c] = await sql`
        select id from category
        where household_id = ${actor.household_id} and archived_at is null
          and lower(name) = ${hint} and scope <> 'income'
        limit 1`;
      return (c?.id as string | undefined) ?? null;
    });
  }

  return {
    ok: true,
    scan: out.scan,
    missing: whatIsMissing(out.scan),
    suggestedCategoryId,
  };
}
