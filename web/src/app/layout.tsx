import type { Metadata, Viewport } from 'next';
import RegisterSW from './RegisterSW';
import SyncQueue from './SyncQueue';
import { Inter } from 'next/font/google';
import './globals.css';

/* Inter, for a ledger, for two reasons that are not taste.

   Numbers: it carries true tabular figures (tnum) and a slashed zero (zero).
   Without fixed-width digits a column of amounts does not line up, which is
   the one thing a column of amounts is for — and 0 against O matters when the
   figure is money.

   Text: it was drawn for screens rather than adapted to them. A tall x-height
   keeps 12px labels legible, and the ink traps stop counters filling in at the
   sizes this app actually uses. It is variable, so weight carries hierarchy
   without loading six files, and its optical size axis handles the jump from a
   11px label to a 38px balance. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui-loaded',
  display: 'swap',
  /* No `axes: ['opsz']`. The optical-size axis is a genuinely nice thing to
     have across an 11px label and a 38px balance, and it costs 25KB on the
     one font file that blocks first paint — 73KB against 48KB. The type
     scale already sets its own letter-spacing per step, which is the manual
     version of most of what opsz was doing, so the axis was being paid for
     twice. */
});

export const metadata: Metadata = {
  title: 'Quiet Ledger',
  description: 'One set of books for your household.',
  appleWebApp: { capable: true, title: 'Ledger', statusBarStyle: 'default' },
  /* iOS ignores the manifest's icons for the home screen and uses this one,
     so it has to be declared separately or an installed app gets a screenshot
     of the page as its icon. */
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

// The theme colour follows the scheme so the iOS status bar and the Android
// task-switcher match the header the user is actually looking at.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#233D4D' },
    { media: '(prefers-color-scheme: dark)', color: '#0D171E' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <SyncQueue />
        <RegisterSW />
      </body>
    </html>
  );
}
