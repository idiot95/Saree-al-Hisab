import type { NextConfig } from 'next';

/* Headers that apply to every response. The Content-Security-Policy is set
   per-request in src/proxy.ts instead, because it carries a nonce.

   Referrer-Policy is the one worth pausing on: invitations and password resets
   travel as /join/<token> and /reset/<token>, so the URL itself is a
   credential. `no-referrer` means that token can never ride along in a Referer
   header to anywhere else. */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), '
      + 'microphone=(), payment=(), usb=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    /* Keep a page the phone has just shown for 30 seconds, so going back to
       it — the Loan centre after a tab, Home after an entry — is instant
       instead of another round trip. Every write goes through a Server Action
       that calls revalidatePath, which empties this cache, so a figure you
       just changed is never served stale. */
    staleTimes: { dynamic: 30 },
    /* The largest honest body: an entry's five bills of 2 MB each travel as
       base64 (about 13.4 MB with the other fields); a holding's five photos go
       as files and are smaller. The default is 1 MB, which refused a single
       large bill. Only signed-in members reach an action, and each one
       validates what it reads. */
    serverActions: { bodySizeLimit: '14mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
