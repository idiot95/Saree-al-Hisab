/* Where a phone should send its forwarded messages, and whether that address will last.

   The configured origin wins (AUTH_URL, which production must set: owner-notes). Without it, the request's own
   host, over https — a key must never travel in clear — except on the developer's own machine, where the first
   x-forwarded-proto (or http) is kept.

   A Vercel preview has its own per-deploy host (`<project>-<hash>-<team>.vercel.app`), which goes away with the
   preview. A phone set up there would post to a dead address later, so `preview` says the address is one of those:
   a vercel.app host that is not the production alias (VERCEL_PROJECT_PRODUCTION_URL), or any host while VERCEL_ENV
   is "preview". The screen warns; the address is still shown, because a preview is where a guide is tried. */
export type CaptureOriginInput = {
  authUrl?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  /** VERCEL_PROJECT_PRODUCTION_URL: the production alias's host, no scheme. */
  productionHost?: string | null;
  /** VERCEL_ENV: production, preview or development. */
  vercelEnv?: string | null;
};

const bare = (host: string) => host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();

export function captureOrigin(i: CaptureOriginInput): { origin: string; preview: boolean } {
  if (i.authUrl) {
    try {
      const u = new URL(i.authUrl);
      return { origin: u.origin, preview: false };
    } catch { /* unparsable: fall back to the request */ }
  }
  const host = i.host || 'localhost';
  const name = bare(host);
  const local = name === 'localhost' || name === '127.0.0.1' || name === '::1';
  const forwarded = i.forwardedProto?.split(',')[0]?.trim();
  const proto = local ? (forwarded === 'https' ? 'https' : 'http') : 'https';
  const prod = i.productionHost ? bare(i.productionHost.replace(/^https?:\/\//, '').replace(/\/.*$/, '')) : null;
  const preview = !local && (i.vercelEnv === 'preview' || (name.endsWith('.vercel.app') && name !== prod));
  return { origin: `${proto}://${host}`, preview };
}
