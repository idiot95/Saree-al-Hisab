/* Light or dark is a property of the phone in the hand, not of the
   household, so it lives in a cookie on that device rather than a column on
   the books. The root layout reads the cookie and stamps data-theme on
   <html>; tokens.css already honours it. 'system' is the absence of a
   cookie, which is exactly what "follow the phone" means. */

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'ql.theme';

/** The forced scheme, or null for "follow the phone". Anything else in the
 *  cookie — an old value, a hand-edit — is treated as absent. */
export function forcedTheme(value: string | undefined): 'light' | 'dark' | null {
  return value === 'light' || value === 'dark' ? value : null;
}
