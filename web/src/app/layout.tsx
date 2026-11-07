import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { platformOf } from '@/lib/platform';
import { forcedTheme, THEME_COOKIE } from '@/lib/theme';
import { actorOrNull } from '@/db/queries';
import { CurrencyProvider } from './currency';
import { Suspense } from 'react';
import NavTrail from './NavTrail';
import RegisterSW from './RegisterSW';
import SyncQueue from './SyncQueue';
import Housekeeping from './Housekeeping';
import PendingSkeleton from './PendingSkeleton';
import InstantAdd from './add/InstantAdd';
import localFont from 'next/font/local';
import './globals.css';

/* Inter, for a ledger, for two reasons that are not taste.

   Numbers: it carries true tabular figures (tnum). Without fixed-width digits
   a column of amounts does not line up, which is the one thing a column of
   amounts is for. (Google's build of Inter has no slashed-zero `zero`
   feature, so the stylesheet's request for one draws the plain zero; P5
   review M6.)

   Text: it was drawn for screens rather than adapted to them. A tall x-height
   keeps 12px labels legible, and the ink traps stop counters filling in at the
   sizes this app actually uses. It is variable, so weight carries hierarchy
   without loading six files, and its optical size axis handles the jump from a
   11px label to a 38px balance. */
const inter = localFont({
  /* Google's Inter, cut to the `latin` subset plus ₹ and → (scripts/inter-font.mjs, npm run fonts:inter): the one
     text file preloaded with the page. ₹ is outside Google's `latin`, so with next/font/google's subsets every
     amount drew its sign in the fallback face, then fetched the 83KB latin-ext file late and laid the figures out
     again (perf-findings §3, row 7). It carries every currency sign lib/money.ts writes that Inter has, too. */
  src: './fonts/inter.woff2',
  weight: '100 900',
  variable: '--font-ui-loaded',
  display: 'swap',
  /* No `axes: ['opsz']`. The optical-size axis is a genuinely nice thing to
     have across an 11px label and a 38px balance, and it costs 25KB on the
     one font file that blocks first paint — 73KB against 48KB. The type
     scale already sets its own letter-spacing per step, which is the manual
     version of most of what opsz was doing, so the axis was being paid for
     twice. */
});
/* One face: v3 dropped Instrument Serif (spec §3.2). Titles are Inter bold, like everything else. */

/* The icon font: Material Symbols Rounded, subset to the glyphs the app names
   (scripts/icons-font.mjs), committed and served from this origin. `block`,
   not `swap`: until it arrives an icon's ligature text would show as the word
   "shopping_cart", which is worse than a moment of nothing. */
const icons = localFont({ src: './fonts/material-symbols.woff2', variable: '--font-icons', display: 'block' });

export const metadata: Metadata = {
  title: 'Saree al-Hisab',
  description: 'One set of books for your household.',
  /* The home-screen name, which iOS truncates at about a dozen characters.
     "Saree al-Hisab" is the app; "Hisab" is what fits under the icon and is
     what anyone would say out loud anyway. */
  appleWebApp: { capable: true, title: 'Hisab', statusBarStyle: 'default' },
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

/* The header colour in each scheme: what the iOS status bar and the Android
   task-switcher paint behind the app. */
const HEADER = { light: '#F8F5F4', dark: '#130E12' } as const;

async function chosenTheme() {
  return forcedTheme((await cookies()).get(THEME_COOKIE)?.value);
}

// The theme colour follows the scheme so the status bar matches the header
// the user is actually looking at. When they have chosen a scheme under
// Household it is one colour; otherwise it follows the phone.
export async function generateViewport(): Promise<Viewport> {
  const forced = await chosenTheme();
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    // The phone's keyboard shrinks the page rather than covering it, so a
    // button pinned to the bottom rises above the keys where the phone allows.
    interactiveWidget: 'resizes-content',
    themeColor: forced ? HEADER[forced] : [
      { media: '(prefers-color-scheme: light)', color: HEADER.light },
      { media: '(prefers-color-scheme: dark)', color: HEADER.dark },
    ],
  };
}

export default async function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  /* data-theme is what tokens.css switches on; color-scheme is what the
     browser switches on for its own scrollbars and form controls. Both, or a
     dark page gets a light date picker. Absent, both follow the phone. */
  const forced = await chosenTheme();
  /* The same lookup the page is about to make, answered once (db/queries
     caches it per request): the household's currency has to reach client
     components through context, and the layout is the one place above all
     of them. Nobody signed in, or no household yet, and it is rupees. */
  const actor = await actorOrNull();
  const h = await headers();
  const platform = platformOf(h.get('user-agent') ?? '', h.get('sec-ch-ua-platform'));
  return (
    <html lang="en" className={`${inter.variable} ${icons.variable}`} data-theme={forced ?? undefined} data-platform={platform}
      style={forced ? { colorScheme: forced } : undefined}>
      <body className="group/app">
        <CurrencyProvider currency={actor?.currency ?? 'INR'}>
          {children}
          {/* Add Entry as a drawer over the screen it was opened from (app/@modal). */}
          {modal}
          {/* The same drawer, opened on the tab bar's tap before /add has arrived (add/instant.ts). */}
          {actor?.household_id && <Suspense fallback={null}><InstantAdd householdId={actor.household_id} /></Suspense>}
          {actor?.household_id && <Housekeeping />}
          <SyncQueue />
          {/* It reads the query (a same-screen change is done when the query is), so it needs a boundary too. */}
          <Suspense fallback={null}><PendingSkeleton /></Suspense>
          {/* useSearchParams needs a boundary of its own, or the whole tree would wait on it. */}
          <Suspense fallback={null}><NavTrail /></Suspense>
        </CurrencyProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
