import AddEntry from '../../add/AddEntry';
import { loadAdd, type AddSearch } from '../../add/data';
import AddDrawer from './AddDrawer';

export const dynamic = 'force-dynamic';

/* Add Entry tapped from inside the app: a drawer over the screen you were on, dragged down (or Close) to put it
   away, which goes back rather than Home. Same loader and same form as the full page at /add. */
export default async function AddSheet({ searchParams }: { searchParams: Promise<AddSearch> }) {
  const props = await loadAdd(await searchParams);
  return (
    <AddDrawer>
      <AddEntry {...props} sheet />
    </AddDrawer>
  );
}
