import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, billsDue, duplicatesFor } from '@/db/queries';
import { format } from '@/lib/money';
import { HEADER_BG } from '../auth-ui';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import DuplicateCard from './DuplicateCard';

export const metadata = { title: 'Inbox · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* Things that want a decision, and nothing that does not. An inbox which
   collects notices nobody can act on stops being read, and then the one item
   that mattered is missed along with the rest. */
export default async function Inbox() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const [dupes, bills] = await Promise.all([
    duplicatesFor(actor.household_id),
    billsDue(actor.household_id),
  ]);
  const canWrite = actor.role !== 'viewer';
  const count = dupes.length + bills.length;

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Link href="/" aria-label="Back" style={{
          width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
        }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="t" style={{ margin: 0, fontSize: 27, letterSpacing: '-.018em' }}>Inbox</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.84)' }}>
          {count === 0 ? 'Nothing needs you' : `${count} ${count === 1 ? 'thing' : 'things'} to look at`}
        </p>
      </header>

      {count === 0 ? (
        <div style={{
          margin: '46px 34px', textAlign: 'center', display: 'flex',
          flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <span style={{
            width: 66, height: 66, borderRadius: 999, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
          }}>
            <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
          </span>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '30ch' }}>
            No possible duplicates and no bills due. This fills itself when
            something wants deciding.
          </p>
        </div>
      ) : (
        <div style={{ paddingTop: 20 }}>
          {bills.length > 0 && (
            <>
              <Head>Card bills</Head>
              <section className="el" style={{
                margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
              }}>
                {bills.map((b, i) => {
                  const soon = b.days_away <= 5;
                  return (
                    <div key={b.account_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 78,
                      borderBottom: i === bills.length - 1 ? undefined : '1px solid var(--c-rule)',
                    }}>
                      <span style={{
                        width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: soon ? 'var(--c-danger-tint)' : 'var(--c-warn-tint)',
                        color: soon ? 'var(--c-danger)' : 'var(--c-warn)',
                      }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" />
                        </svg>
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>
                          {b.account}{b.last4 && ` · ${b.last4}`}
                        </span>
                        <span style={{
                          fontSize: 12.5, color: soon ? 'var(--c-danger)' : 'var(--c-meta)',
                        }}>
                          {b.days_away < 0 ? `overdue by ${-b.days_away} days`
                            : b.days_away === 0 ? 'due today'
                            : `due in ${b.days_away} days`}
                          {' · '}{b.entries} {b.entries === 1 ? 'purchase' : 'purchases'}
                        </span>
                      </span>
                      <span className="t" style={{ fontSize: 17 }}>{format(Number(b.charged))}</span>
                    </div>
                  );
                })}
              </section>
              <p style={{
                margin: '-14px 20px 22px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
              }}>
                Record the payment as a transfer from the bank to the card. It is a move, not
                spending — the purchases were counted on the days they happened.
              </p>
            </>
          )}

          {dupes.length > 0 && (
            <>
              <Head>Possibly recorded twice</Head>
              {dupes.map((d) => (
                <DuplicateCard
                  key={`${d.low_id}:${d.high_id}`}
                  reason={d.reason}
                  low={{
                    id: d.low_id, amount: d.low_amount,
                    on: new Date(d.low_on).toISOString().slice(0, 10),
                    merchant: d.low_merchant, who: d.low_who,
                    account: d.low_account, category: d.low_category,
                  }}
                  high={{
                    id: d.high_id, amount: d.high_amount,
                    on: new Date(d.high_on).toISOString().slice(0, 10),
                    merchant: d.high_merchant, who: d.high_who,
                    account: d.high_account, category: d.high_category,
                  }}
                />
              ))}
              {!canWrite && (
                <p style={{
                  margin: '0 20px', fontSize: 12.5, color: 'var(--c-meta)', textAlign: 'center',
                }}>
                  Only owners and contributing members can act on these.
                </p>
              )}
            </>
          )}
        </div>
      )}
      <TabBar current="/inbox" />
    </main>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, letterSpacing: '-.012em' }}>
        {children}
      </h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}
