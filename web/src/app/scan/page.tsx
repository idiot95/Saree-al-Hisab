import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, scanningState } from '@/db/queries';
import { HEADER_BG } from '../auth-ui';
import ScanForm from './ScanForm';

export const metadata = { title: 'Scan a receipt · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Scan() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const scanning = await scanningState(actor.household_id);

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 26px 26px',
        padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Link href="/add" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
          Scan a receipt
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
          It reads the total, the date and the shop. You check them and save — nothing is
          recorded on your behalf.
        </p>
      </header>

      <div style={{ paddingTop: 20 }}>
        <ScanForm canScan={scanning.has_key && actor.role !== 'viewer'} />
        <p style={{
          margin: '18px 20px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          The photo goes to Google&rsquo;s Gemini using your household&rsquo;s own key, and is
          not stored by this app. What comes back is a suggestion: the amount is checked to be
          a real number, the date to be a real and recent date, and the category to be one you
          already have. Anything that fails those checks comes back blank rather than guessed.
        </p>
      </div>
    </main>
  );
}
