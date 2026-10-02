import { redirect } from 'next/navigation';
import { actorOrNull, scanningState } from '@/db/queries';
import ScanForm from './ScanForm';
import PageHead from '../PageHead';
import TabBar from '../TabBar';
import Screen from '../Screen';
import { TAB_BAR_SPACE } from '../tabs';

export const metadata = { title: 'Scan a receipt · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Scan() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const scanning = await scanningState(actor.household_id);

  return (
    <Screen>
      <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/add" title="Scan a receipt"
          sub="It reads the total, the date and the shop. You check them and save; nothing is recorded on your behalf." />

        <div style={{ paddingTop: 20 }}>
          <ScanForm canScan={scanning.has_key && actor.role !== 'viewer'} />
          <p style={{
            margin: '18px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)',
          }}>
            The photo goes to Google&rsquo;s Gemini using your household&rsquo;s own key, and is
            not stored by this app. What comes back is a suggestion: the amount is checked to be
            a real number, the date to be a real and recent date, and the category to be one you
            already have. Anything that fails those checks comes back blank rather than guessed.
          </p>
        </div>
        <TabBar current="/scan" />
      </main>
    </Screen>
  );
}
