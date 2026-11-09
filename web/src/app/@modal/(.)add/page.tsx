import { loadAdd, type AddSearch } from '../../add/data';
import AddSheet from './AddSheet';

export const dynamic = 'force-dynamic';

/* Add Entry tapped from inside the app: a drawer over the screen you were on, dragged down (or Close) to put it
   away, which goes back rather than Home. Same loader and same form as the full page at /add. From the tab bar the
   drawer is already open by the time this arrives (add/instant.ts); AddSheet hands it these props. */
export default async function Page({ searchParams }: { searchParams: Promise<AddSearch> }) {
  const props = await loadAdd(await searchParams);
  return <AddSheet {...props} />;
}
