import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000;

/** What the intent is for. 'link' comes from Household and is honoured only
 *  alongside the same person's live session; 'reset' comes from a spent
 *  reset link and stands in for one. The purpose is inside the MAC and not in
 *  the token, so a seal made for one can never be opened as the other. */
export type IntentPurpose = 'link' | 'reset';

const mac = (purpose: IntentPurpose, payload: string, secret: string) =>
  createHmac('sha256', secret).update(`${purpose}\n${payload}`).digest();

/** `base64url(userId.expiryMs).base64url(hmac)`, valid for 10 minutes. */
export function sealLinkIntent(
  userId: string, secret: string, nowMs: number, purpose: IntentPurpose = 'link',
): string {
  const payload = `${userId}.${nowMs + TTL_MS}`;
  return `${Buffer.from(payload).toString('base64url')}.${mac(purpose, payload, secret).toString('base64url')}`;
}

/** The user id, or null for anything expired, forged, malformed or sealed for
 *  another purpose. Never throws. */
export function openLinkIntent(
  token: string, secret: string, nowMs: number, purpose: IntentPurpose = 'link',
): string | null {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = Buffer.from(parts[0], 'base64url').toString();
    const given = Buffer.from(parts[1], 'base64url');
    const want = mac(purpose, payload, secret);
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
    const dot = payload.lastIndexOf('.');
    if (dot < 1) return null;
    const expiry = Number(payload.slice(dot + 1));
    if (!Number.isFinite(expiry) || nowMs > expiry) return null;
    return payload.slice(0, dot);
  } catch {
    return null;
  }
}
