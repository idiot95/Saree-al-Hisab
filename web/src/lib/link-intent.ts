import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000;

const mac = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest();

/** `base64url(userId.expiryMs).base64url(hmac)`, valid for 10 minutes. */
export function sealLinkIntent(userId: string, secret: string, nowMs: number): string {
  const payload = `${userId}.${nowMs + TTL_MS}`;
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload, secret).toString('base64url')}`;
}

/** The user id, or null for anything expired, forged or malformed. Never throws. */
export function openLinkIntent(token: string, secret: string, nowMs: number): string | null {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = Buffer.from(parts[0], 'base64url').toString();
    const given = Buffer.from(parts[1], 'base64url');
    const want = mac(payload, secret);
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
