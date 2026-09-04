import type { Metadata, Viewport } from 'next';
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
      <body>{children}</body>
    </html>
  );
}
