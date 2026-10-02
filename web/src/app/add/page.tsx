import AddEntry from './AddEntry';
import { loadAdd, type AddSearch } from './data';
import Screen from '../Screen';

export const metadata = { title: 'New entry · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* The full page: opened by a direct link, a scan's draft or a reload. Tapped from inside the app, /add opens as a
   drawer over the screen instead (app/@modal/(.)add/page.tsx), from the same loader. */
export default async function Page({ searchParams }: { searchParams: Promise<AddSearch> }) {
  const props = await loadAdd(await searchParams);
  return (
    <Screen>
      <AddEntry {...props} />
    </Screen>
  );
}
