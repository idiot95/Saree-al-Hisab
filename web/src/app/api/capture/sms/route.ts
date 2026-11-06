import { sql, withHousehold } from '@/db/client';
import { purgeSmsBodiesIn } from '@/lib/sms-draft';
import { draftExists, insertDraft, lookupCaptureToken, touchCaptureToken } from '@/db/capture';
import { tooManyIn } from '@/db/rate-limit';
import { geminiKeyFor } from '@/db/queries';
import { readSmsWithModel } from '@/db/gemini';
import { open as unseal } from '@/lib/secretbox';
import { isOtp, parseSms, validateCapture, type ParsedSms } from '@/lib/sms';

/* POST /api/capture/sms — a phone (an iPhone Shortcut, an Android forwarder)
   sends a bank message here with `Authorization: Bearer <token>`, and it
   becomes a draft under To review. Public and token-gated, so everything that
   arrives is hostile until shown otherwise.

   The answer is a bare status and an empty body, always: 401 for anything
   wrong with who is asking, 413 over 2 KB of bytes, 400 for a body that is not
   the JSON we take or has not all arrived within five seconds, 429 past 60 an hour for one token, and 202 for everything
   else — a new draft, a duplicate, a one-time password that was dropped, a
   message nothing could be read from. Which of those it was is nobody's
   business but the household's. Logs carry the status and a reason code;
   never the token, never the body.

   The proxy does not run on this path (src/proxy.ts matcher): no session, no
   page CSP, no cookies. No CORS headers either — a phone shortcut is not a
   browser, and a browser on another origin should be refused. */

const MAX_BYTES = 2048;
const READ_MS = 5_000;
const PER_HOUR = 60;
const BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/i;

const bare = (status: number, extra: Record<string, string> = {}) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...extra } });

function refuse(status: number, reason: string) {
  console.warn('capture:', status, reason);
  return bare(status);
}

/** The raw body, 'over' once it passes the cap, or 'slow' when it has not
 *  all arrived within READ_MS. Counted in bytes as they arrive, so a body with
 *  no Content-Length (or a false one) is cut off too; the deadline stops a
 *  caller holding a connection open by trickling it. */
async function readCapped(req: Request): Promise<Uint8Array | 'over' | 'slow'> {
  const declared = req.headers.get('content-length');
  if (declared !== null && Number(declared) > MAX_BYTES) return 'over';
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const deadline = AbortSignal.timeout(READ_MS);
  const late = new Promise<'slow'>((resolve) => deadline.addEventListener('abort', () => resolve('slow'), { once: true }));
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await Promise.race([reader.read(), late]);
    if (next === 'slow') {
      await reader.cancel().catch(() => {});
      return 'slow';
    }
    const { done, value } = next;
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return 'over';
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

const NOTHING: ParsedSms = { amountMinor: null, currency: null, direction: null, last4: null, merchant: null, date: null };

/** What the household's own model key makes of a message the regex could not
 *  place. Only the gaps are filled, and the direction only on a confident
 *  answer — income booked as an expense is wrong both ways at once. */
async function withModel(householdId: string, text: string, parsed: ParsedSms) {
  try {
    const sealed = await geminiKeyFor(householdId);
    const secret = process.env.AUTH_SECRET;
    const key = sealed && secret ? unseal(sealed, secret) : null;
    if (!key) return null;
    const scan = await readSmsWithModel(key, text);
    if (!scan) return null;
    const direction = scan.confidence !== 'high' ? null
      : scan.kind === 'expense' ? 'debit' as const : scan.kind === 'income' ? 'credit' as const : null;
    if (!direction) return null;
    const useAmount = parsed.amountMinor === null && scan.amountMinor !== null;
    return {
      ...parsed,
      direction,
      amountMinor: useAmount ? scan.amountMinor : parsed.amountMinor,
      currency: useAmount ? 'INR' : parsed.currency,
      date: parsed.date ?? scan.occurredOn,
      merchant: parsed.merchant ?? scan.merchant?.slice(0, 40) ?? null,
    };
  } catch (e) {
    console.error('capture: model fallback', (e as Error)?.name ?? 'unknown');
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    // 1. The header's shape. Nothing else is looked at without one.
    const m = BEARER.exec(req.headers.get('authorization') ?? '');
    if (!m) return bare(401);   // not logged: scanners and stray requests are noise
    const token = m[1];

    // 2. The byte cap, before anything is parsed.
    const raw = await readCapped(req);
    if (raw === 'over') return refuse(413, 'size');
    if (raw === 'slow') return refuse(400, 'slow');

    // 3. JSON, and the shape we take.
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    } catch {
      return refuse(400, 'json');
    }
    const capture = validateCapture(json);
    if ('error' in capture) return refuse(400, capture.error);

    // 4–5. The token, by its hash only, live, and held by someone still in
    // that household who may write there: one query, one reason, so an
    // unknown, revoked, removed and viewer token cannot be told apart.
    const t = await lookupCaptureToken(token);
    if (!t) return refuse(401, 'token');

    // 6. Sixty an hour, per token.
    const wait = await tooManyIn(`capture:${t.id}`, PER_HOUR, 60 * 60);
    if (wait) {
      console.warn('capture:', 429, 'rate');
      return bare(429, { 'Retry-After': String(wait) });
    }

    // 7. A one-time password is dropped before anything reads or keeps it.
    if (isOtp(capture.text)) return bare(202);

    // 8. The regex parse. It never fails the request.
    let parsed: ParsedSms = NOTHING;
    try {
      parsed = parseSms(capture.text, capture.sender ?? undefined);
    } catch (e) {
      console.error('capture: parse', (e as Error)?.name ?? 'unknown');
    }

    // 9. The model, only for a message with no direction and a household key.
    let via: 'sms' | 'model' = 'sms';
    // A message already stored is not worth the household's quota twice.
    if (parsed.direction === null && !(await draftExists(t.household_id, capture.text))) {
      const better = await withModel(t.household_id, capture.text, parsed);
      if (better) { parsed = better; via = 'model'; }
    }

    // 10–12. The draft (a duplicate does nothing), the token's last use, and the purge.
    // One transaction, scoped to the token's household.
    await withHousehold(t.household_id, async () => {
      await insertDraft(t.household_id, t.user_id, {
        sender: capture.sender, body: capture.text, receivedAt: capture.receivedAt, parsed: { ...parsed, via },
      });
      await touchCaptureToken(t.household_id, t.id);
      /* The thirty-day rule, held even for a household that never opens the app: every arrival clears the text of
         anything decided or older than thirty days. */
      await purgeSmsBodiesIn(sql, t.household_id);
    });
    return bare(202);
  } catch (e) {
    // A Postgres error's detail carries the row; only its code and constraint are logged.
    const pg = e as { name?: string; code?: string; constraint_name?: string };
    console.error('capture:', 500, pg.code ?? pg.name ?? 'unknown', pg.constraint_name ?? '');
    return bare(500);
  }
}

const notAllowed = () => bare(405, { Allow: 'POST' });
export const GET = notAllowed;
export const HEAD = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = notAllowed;
