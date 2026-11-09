'use client';

import './globals.css';

/* When the root layout itself fails — its one read (who is asking) could not reach the database — nothing of the
   app's frame is there to draw in, so this draws its own document. The same words as error.tsx, and the same rule:
   never the error's text. No server data, no fonts or icons from the layout (their CSS variables are set there), no
   inline script: the mark is an inline SVG, and the only behaviour is Next's own retry. The scheme follows the phone,
   since the chosen-theme cookie is the layout's to read. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <title>Something went wrong · Saree al-Hisab</title>
        <main className="flex min-h-dvh flex-col px-4 pb-10 pt-16">
          <section role="alert" className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-card px-6 py-8 text-center">
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-primary">
              <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
            <h1 className="text-title-2 font-bold leading-tight">The app didn’t load</h1>
            <p className="max-w-[32ch] text-subhead leading-relaxed text-muted-foreground">
              Something went wrong on the way, or the signal dropped. Nothing you saved is lost.
            </p>
            <button type="button" onClick={() => retry()}
              className="mt-1 flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-body font-semibold text-primary-foreground">
              Try again
            </button>
            {/* A plain link: a full load of Home, which is what a broken layout needs. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="flex min-h-11 items-center px-2 text-body font-medium text-primary">Back to Home</a>
          </section>
        </main>
      </body>
    </html>
  );
}
