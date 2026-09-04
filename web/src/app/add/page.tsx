import AddEntry from './AddEntry';
import { currentActor, categoriesFor, methodsFor, accountsFor } from '@/db/queries';

export const metadata = { title: 'New entry · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { household_id } = await currentActor();
  const [categories, methods, accounts] = await Promise.all([
    categoriesFor(household_id),
    methodsFor(household_id),
    accountsFor(household_id),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AddEntry
      categories={categories.map((c) => ({ id: c.id, name: c.name, tint: c.tint }))}
      methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
      accounts={accounts}
      today={today}
    />
  );
}
