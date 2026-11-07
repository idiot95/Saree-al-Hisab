'use client';

import Link from '@/app/NavLink';
import { Icon } from './Icon';
import Landed from './Landed';

/* When a screen fails to draw: what happened in plain words, that nothing saved is lost, and the one thing to do —
   try again. Never the error itself: in production a server error reaches here as a generic message and a digest,
   and neither means anything to the person holding the phone (the digest is in the server's log, where it is useful).
   Retry asks the server for the screen again; Home is the way out when it keeps failing. */
export default function ScreenError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background px-[var(--gutter)] pb-10 pt-16 text-foreground">
      {/* This is what the tap landed on: the frame drawn for it comes down. */}
      <Landed />
      <section role="alert" className="flex flex-col items-center gap-3 rounded-[22px] bg-card px-6 py-8 text-center">
        <Icon name="sync_problem" size={36} className="text-primary" />
        <h1 className="text-large-title font-bold tracking-tight leading-tight">That screen didn’t load</h1>
        <p className="max-w-[32ch] text-subhead leading-relaxed text-muted-foreground">
          Something went wrong on the way, or the signal dropped. Nothing you saved is lost.
        </p>
        <button type="button" onClick={() => retry()}
          className="press mt-1 flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-body font-semibold text-primary-foreground in-data-[platform=android]:min-h-12">
          <Icon name="restore" size={18} />Try again
        </button>
        <Link href="/" className="flex min-h-11 items-center px-2 text-body font-medium text-primary in-data-[platform=android]:min-h-12">
          Back to Home
        </Link>
      </section>
    </main>
  );
}
