/* next/navigation's redirect() and notFound() work by throwing. A catch block
   that swallows everything therefore turns a redirect into an error message —
   which is how "you have been signed out" becomes "something went wrong".
   Every catch around an action helper has to let these through. */
export function rethrowControlFlow(e: unknown): void {
  const digest = (e as { digest?: unknown })?.digest;
  if (typeof digest === 'string'
      && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')) {
    throw e;
  }
}
