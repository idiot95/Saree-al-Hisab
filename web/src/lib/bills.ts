/* The one rule for a file kept with something: a bill on an entry, a photo or
   a valuation slip on a holding. Five to a save, two megabytes each, images
   and PDFs only. The tables carry the same ceilings as CHECKs, so no writer
   can get around them; this is where a refusal becomes a sentence, and where
   the entry form, "attach a bill later" and the holdings forms all agree. */

export const BILL_MAX_FILES = 5;
export const BILL_MAX_BYTES = 2 * 1024 * 1024;
export const BILL_MIME: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export type Bill = { name: string; mime: string; buf: Buffer };

/** Why this file cannot be kept, or null when it can. */
export function billProblem(mime: unknown, size: number): string | null {
  if (typeof mime !== 'string' || !BILL_MIME.has(mime)) return 'Only images and PDFs can be attached.';
  if (size <= 0) return 'That file is empty.';
  if (size > BILL_MAX_BYTES) return 'Each file must be under 2 MB.';
  return null;
}

/** A file ready to store, or null when it fails the rule. */
export function billFrom(name: unknown, mime: unknown, buf: Buffer): Bill | null {
  if (billProblem(mime, buf.length)) return null;
  return { name: String(name ?? '').slice(0, 120) || 'Bill', mime: mime as string, buf };
}

/** The shape the phone sends with an entry: { name, mime, data: base64 }. */
export function billFromBase64(f: unknown): Bill | null {
  const { name, mime, data } = (f ?? {}) as { name?: unknown; mime?: unknown; data?: unknown };
  if (typeof data !== 'string' || typeof mime !== 'string') return null;
  return billFrom(name, mime, Buffer.from(data, 'base64'));
}
