import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, allCategories } from '@/db/queries';
import { headerBg } from '../auth-ui';
import CategoryEditor from './CategoryEditor';

export const metadata = { title: 'Categories · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Categories() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const categories = await allCategories(actor.household_id);
  const live = categories.filter((c) => !c.archived).length;

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: 44 }}>
      <header className="el2" style={{
        background: headerBg('gold'), color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Link href="/budget" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
          Categories
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.84)' }}>
          {live} in use. The order here is the order Add Entry offers them in, so the three you
          use daily are worth putting first.
        </p>
      </header>

      <div style={{ paddingTop: 20 }}>
        <CategoryEditor categories={categories} canEdit={actor.role !== 'viewer'} />
        <p style={{ margin: '0 20px', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Renaming is safe: every entry points at the category itself, so they all follow the
          new name and no month changes value.
        </p>
      </div>
    </main>
  );
}
