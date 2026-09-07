import 'server-only';
import { PROMPT, readScan, type Scanned } from '@/lib/receipt';

/* The call out to Gemini. Lives in src/db rather than src/lib because it is not
   pure: it reaches the network and it holds a household's key.

   "latest" is used on purpose. A pinned version disappears — the first key test
   here came back with "models/gemini-2.0-flash is no longer available" — and a
   receipt scanner that stops working because a model was retired is worse than
   one whose wording shifts slightly. */
const MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 45_000;

export const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
export const MAX_BYTES = 6 * 1024 * 1024;

export type ScanOutcome =
  | { ok: true; scan: Scanned }
  | { ok: false; error: string };

export async function scanReceipt(
  key: string, bytes: Buffer, mimeType: string,
): Promise<ScanOutcome> {
  if (!(ACCEPTED as readonly string[]).includes(mimeType)) {
    return { ok: false, error: 'That has to be a photo (PNG, JPEG or WebP) or a PDF.' };
  }
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: 'That file is over 6 MB. A photo of the receipt is enough.' };
  }

  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });

  /* 503 "high demand" is common enough on the multimodal path that the first
     real receipt this app ever scanned hit it. It clears in seconds, so it is
     retried rather than handed back as a failure the person has to act on. */
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body,
      });
    } catch (e) {
      if ((e as Error)?.name === 'TimeoutError') {
        return { ok: false, error: 'That took too long. Try again, or a smaller photo.' };
      }
      return { ok: false, error: 'Could not reach the scanning service.' };
    }
    if (res.status !== 503) break;
  }
  if (!res) return { ok: false, error: 'Could not reach the scanning service.' };

  if (!res.ok) {
    /* The upstream message can name the key or the project, so it is logged
       and not shown. What the person gets back is what they can act on. */
    const body = await res.text().catch(() => '');
    console.error('gemini refused:', res.status, body.slice(0, 300));
    if (res.status === 400 || res.status === 403) {
      return { ok: false, error: 'That key was refused. Check it in Household settings.' };
    }
    if (res.status === 429) {
      return { ok: false, error: 'The key is out of quota for now. Try again later.' };
    }
    if (res.status === 503) {
      return { ok: false, error: 'Google is busy. Wait a moment and try again.' };
    }
    return { ok: false, error: 'The scanning service is not answering just now.' };
  }

  const json = await res.json().catch(() => null) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) return { ok: false, error: 'Nothing came back. Try a clearer photograph.' };

  const parsed = readScan(text);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  return { ok: true, scan: parsed };
}

/** A cheap call that proves a key works, without spending an image on it. */
export async function testKey(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with: ok' }] }] }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    console.error('gemini key test failed:', res.status, body.slice(0, 200));
    return { ok: false, error: res.status === 429
      ? 'That key is out of quota just now, but it is valid.'
      : 'Google would not accept that key.' };
  } catch {
    return { ok: false, error: 'Could not reach Google to check the key.' };
  }
}
