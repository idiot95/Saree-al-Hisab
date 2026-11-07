import { redirect } from 'next/navigation';
import { actorOrNull, allCategories } from '@/db/queries';
import CategoryEditor from './CategoryEditor';
import PageHead from '../PageHead';
import TabBar from '../TabBar';
import Screen from '../Screen';
import { TAB_BAR_SPACE } from '../tabs';
import { Icon } from '../Icon';

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
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/budget" eyebrow="Plan" title="Categories"
          sub={`${live} in use. Add Entry offers them in this order, so put the everyday ones first.`} />

        <div className="flex flex-col gap-4 pb-8">
          <CategoryEditor categories={categories} canEdit={actor.role !== 'viewer'} />
          <p className="mx-[var(--gutter)] flex items-start gap-1.5 px-0.5 text-[13px] leading-snug text-muted-foreground">
            <Icon name="info" size={16} className="mt-px flex-none" />
            Renaming is safe: every entry points at the category itself, so they all follow the
            new name and no month changes value.
          </p>
        </div>
        <TabBar current="/categories" />
      </main>
    </Screen>
  );
}
