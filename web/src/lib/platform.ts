export type Platform = 'ios' | 'android' | 'other';

/* Which operating system the request came from, for tuning small details
   (the left-edge back swipe, for one). The client hint wins when present
   because it is explicit; it arrives quoted, as «"Android"». An iPad that
   reports itself as a Mac is indistinguishable from a Mac by UA alone and
   falls to 'other'. */
export function platformOf(ua: string, chPlatform?: string | null): Platform {
  const hint = (chPlatform ?? '').replace(/"/g, '').trim().toLowerCase();
  if (hint === 'android') return 'android';
  if (hint === 'ios') return 'ios';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
