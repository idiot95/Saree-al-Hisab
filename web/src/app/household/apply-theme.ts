import type { Theme } from '@/lib/theme';

/* Stamp the choice on the document at once, from the click, so the page
   changes under the thumb rather than after the round trip. The action then
   writes the cookie that makes it stick.

   It lives here rather than in `src/lib` because that half of the codebase is
   compiled without DOM types on purpose — it is the part that has to run
   anywhere — and it lives in its own module rather than inside the component
   because the React compiler reads a document mutation in a component body as
   changing something it does not own. */
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') { delete root.dataset.theme; root.style.colorScheme = ''; }
  else { root.dataset.theme = t; root.style.colorScheme = t; }
}
