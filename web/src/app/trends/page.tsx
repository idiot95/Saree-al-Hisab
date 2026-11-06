import { redirect } from 'next/navigation';

/* Trends is the bottom of Plan now (/budget#trends). The old address still works, with whatever it carried: the
   query comes first and the fragment last, so /trends?m=2026-09-01 lands on /budget?m=2026-09-01#trends. */
export default async function Trends({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) q.append(k, one);
  }
  const query = q.toString();
  redirect(`/budget${query ? `?${query}` : ''}#trends`);
}
