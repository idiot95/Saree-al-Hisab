import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { actorOrNull } from '@/db/queries';

export const metadata = { title: 'Sign in · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function SignIn({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const actor = await actorOrNull();
  if (actor?.household_id) redirect('/');
  const { error } = await searchParams;

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)',
    }}>
      <div className="el2" style={{
        background:
          'repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, rgba(0,0,0,0) 1px 26px),' +
          'radial-gradient(130% 85% at 82% -12%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 62%),' +
          'linear-gradient(150deg,#2C5063 0%,#233D4D 58%,#172B37 100%)',
        color: '#fff', borderRadius: '0 0 32px 32px', padding: '64px 26px 48px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <span style={{
          width: 54, height: 54, borderRadius: 16, background: 'rgba(255,255,255,.16)',
          border: '1px solid rgba(255,255,255,.24)', display: 'flex', alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width={27} height={27} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8}
            strokeLinecap="round" aria-hidden>
            <path d="M4 6.5h16" /><path d="M7 12h10" /><path d="M10 17.5h4" />
          </svg>
        </span>
        <h1 className="t" style={{
          margin: 0, fontSize: 38, lineHeight: 1.06, letterSpacing: '-.02em', textWrap: 'balance',
        }}>
          Every rupee,<br />where you left it.
        </h1>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
          One set of books for your household. Budget a month, and everything reports against it.
        </p>
      </div>

      <div style={{
        marginTop: 'auto', padding: '30px 20px 26px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {error && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderRadius: 14,
            background: 'var(--c-danger-tint)', color: 'var(--c-danger)', fontSize: 13.5, fontWeight: 600,
          }}>
            Google could not sign you in. Try again.
          </div>
        )}

        <form action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/' });
        }}>
          <button type="submit" className="el2" style={{
            width: '100%', minHeight: 58, borderRadius: 16, background: 'var(--c-card)',
            color: 'var(--c-ink)', fontSize: 16.5, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
            border: '1px solid var(--c-border)',
          }}>
            <svg width={20} height={20} viewBox="0 0 48 48" aria-hidden>
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
              <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.2l-7.1-5.6c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.3v5.8C7.8 41.1 15.3 46 24 46z" />
              <path fill="#FBBC05" d="M11.7 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.8H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.4-5.6z" />
              <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 30 2 24 2 15.3 2 7.8 6.9 4.3 14.2l7.4 5.8c1.7-5.2 6.6-9.3 12.3-9.3z" />
            </svg>
            Continue with Google
          </button>
        </form>

        <p style={{
          margin: '10px 4px 0', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center',
          color: 'var(--c-meta)',
        }}>
          Signing in does not put you in anyone&rsquo;s books. A household has to invite you.
        </p>
      </div>
    </main>
  );
}
