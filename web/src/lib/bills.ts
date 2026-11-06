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

/* Serving a stored file back (both /attachment routes). */

/** Strictly a UUID: the loose "36 hex-or-dash characters" let a string of dashes through to the database. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

/** What a stored name is called when it is served. The extension always comes
 *  from the stored mime, never from the name, so "a.html" kept as a PNG is
 *  served as a.png. `ascii` is printable ASCII only; `full` keeps the other
 *  scripts for the RFC 5987 form. Quotes, slashes, semicolons and control
 *  characters (a CR/LF would split the header) never survive. */
export function safeName(name: unknown, mime: unknown): { ascii: string; full: string } {
  const ext = EXT[String(mime)] ?? 'bin';
  const clean = (re: RegExp) => String(name ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029"\\/;]/g, ' ')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(re, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
  const stem = (s: string) => (s.replace(/[_\s]/g, '') ? s : mime === 'application/pdf' ? 'document' : 'photo');
  return { ascii: `${stem(clean(/[^\x20-\x7e]/g))}.${ext}`, full: `${stem(clean(/(?!)/g))}.${ext}` };
}

/** Content-Disposition: inline, ASCII fallback plus filename* for the real name. */
export function dispositionFor(name: unknown, mime: unknown): string {
  const { ascii, full } = safeName(name, mime);
  let star: string;
  try {
    star = encodeURIComponent(full).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  } catch { star = encodeURIComponent(ascii); } // a lone surrogate cannot be encoded
  return `inline; filename="${ascii}"; filename*=UTF-8''${star}`;
}

/** Everything but the bytes' own headers: stored files are shown on their
 *  own, never as a page that could run anything. */
export const SERVE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
} as const;
