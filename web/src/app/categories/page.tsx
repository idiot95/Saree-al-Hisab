import { redirect } from 'next/navigation';
import { actorOrNull, allCategories } from '@/db/queries';
import CategoryEditor from './CategoryEditor';
import PageHead from '../PageHead';
import TabBar from '../TabBar';
import Screen from '../Screen';
import { TAB_BAR_SPACE } from '../tabs';

export const metadata = { title: 'Categories · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Categories() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const categories = await allCategories(actor.household_id);
  const live = categories.filter((c) => !c.archived).length;

  return (
    <Screen>
      <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/budget" eyebrow="Plan" title="Categories"
          sub={`${live} in use. Add Entry offers them in this order, so put the everyday ones first.`} />

        <div style={{ paddingTop: 20 }}>
          <CategoryEditor categories={categories} canEdit={actor.role !== 'viewer'} />
          <p style={{ margin: '0 var(--gutter)', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            Renaming is safe: every entry points at the category itself, so they all follow the
            new name and no month changes value.
          </p>
        </div>
        <TabBar current="/categories" />
      </main>
    </Screen>
  );
}
