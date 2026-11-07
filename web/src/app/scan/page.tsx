import { redirect } from 'next/navigation';
import { actorOrNull, scanningState } from '@/db/queries';
import ScanForm from './ScanForm';
import PageHead from '../PageHead';
import TabBar from '../TabBar';
import Screen from '../Screen';
import { TAB_BAR_SPACE } from '../tabs';
import { Icon } from '../Icon';

export const metadata = { title: 'Scan a receipt · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Scan() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const scanning = await scanningState(actor.household_id);

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/add" title="Scan a receipt"
          sub="It reads the total, the date and the shop. You check them and save; nothing is recorded on your behalf." />

        <div className="flex flex-col gap-4 px-[var(--gutter)] pb-8">
          <ScanForm canScan={scanning.has_key && actor.role !== 'viewer'} />
          <p className="flex items-start gap-1.5 px-0.5 text-subhead leading-snug text-muted-foreground">
            <Icon name="lock" size={16} className="mt-px flex-none" />
            <span>
              The photo goes to Google&rsquo;s Gemini using your household&rsquo;s own key, and is
              not stored by this app. What comes back is a suggestion: the amount is checked to be
              a real number, the date to be a real and recent date, and the category to be one you
              already have. Anything that fails those checks comes back blank rather than guessed.
            </span>
          </p>
        </div>
        <TabBar current="/scan" />
      </main>
    </Screen>
  );
}
