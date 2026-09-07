import type { Metadata, Viewport } from 'next';
import RegisterSW from './RegisterSW';
import { Instrument_Sans, Instrument_Serif } from 'next/font/google';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-ui-loaded',
  display: 'swap',
});
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display-loaded',
  display: 'swap',
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
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
