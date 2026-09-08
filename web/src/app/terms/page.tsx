import Link from 'next/link';
import { actorOrNull } from '@/db/queries';
import { headerBg } from '../auth-ui';
import Screen from '../Screen';
import Back from '../Back';
import { BACK_SPACE } from '../tabs';

export const metadata = { title: 'Terms · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* What you are agreeing to, in the words the rest of the app uses. Every
   claim here is one the code makes good on — the hashing, the encryption,
   the check on every request — and the ones the code does NOT make good on
   yet (deleting an account) are said just as plainly. A promise a reader
   cannot check is worth less than a shorter list they can. Readable before
   signing up, which is why the proxy lets it through without a session. */

const REPO = 'https://github.com/idiot95/Saree-al-Hisab';
const DATED = 'September 2026';
const link: React.CSSProperties = {
  color: 'var(--c-teal)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3,
};

const SECTIONS: { title: string; lines: React.ReactNode[] }[] = [
  {
    title: 'What this is',
    lines: [
      'A set of books for one household, kept by the people in it. Nothing is read from your bank, your messages or your phone: every figure here is one that you or someone in your household typed, scanned and confirmed, or recorded from a schedule.',
      'You can keep more than one household, and belong to households other people opened. Each is its own set of books.',
    ],
  },
  {
    title: 'Who can see your books',
    lines: [
      'The members of your household, at the role its owner gave them, and no one else. No other household, no advertiser, no analytics service — none is connected.',
      'Someone who is invited sees the books only after they have made their own account and opened the invitation sent to their address.',
      'Whoever runs this copy of the app can, in principle, reach the database it stores. That is true of every service that keeps anything for you, and it is worth saying plainly here rather than leaving you to assume.',
    ],
  },
  {
    title: 'How it is kept',
    lines: [
      'The books live in a Postgres database. The storage underneath it is encrypted at rest, and every connection to it is over TLS — the app refuses a plain one.',
      'Your password is never stored. What is stored is a salted scrypt hash of it, which is enough to check the password and useless for recovering it.',
      'A Google AI key you add for receipt scanning is encrypted with AES-256-GCM under a secret that exists only on the server. It is decrypted only to scan, and sent nowhere but Google.',
      'Every request checks, on the server, that you belong to the household you are asking about and that your role allows what you are doing. The database checks it again: the app connects to Postgres as a role that can only see the household a request is for, so a query cannot reach another household’s rows even by mistake. Sessions can be cut off: changing your password or tapping Sign out everywhere ends every other phone’s session on its next tap.',
      'Invitation and password-reset links carry a one-time token, expire, and are sent without a referrer so the address bar does not leak them to the next site.',
    ],
  },
  {
    title: 'What leaves your phone',
    lines: [
      'Entries go to the app’s own server and nowhere else. An entry saved without signal waits on the phone and goes when there is one.',
      'If you turn on receipt scanning, the photo you scan goes to Google’s Gemini API under your own key and your own quota. That is the only third party, and only when you choose it.',
    ],
  },
  {
    title: 'The source is public',
    lines: [
      <>The whole app is at <a href={REPO} style={link}>github.com/idiot95/Saree-al-Hisab</a>. You can read exactly what it does with your data rather than take this page’s word for it.</>,
      'You can also run your own copy against your own database. A Postgres connection string and one secret are all it needs; the README in the repository says how. Then nobody but you holds the books.',
    ],
  },
  {
    title: 'Your account',
    lines: [
      'Change your password, or sign every phone out, under Household. An owner can remove anyone from a household; the entries that person recorded stay, because they are the household’s record, not theirs.',
      'There is no delete-my-account button yet. Until there is, ask whoever runs your copy and they can remove the account and any household only you belong to.',
    ],
  },
  {
    title: 'What this is not',
    lines: [
      'It is not a bank and it moves no money anywhere. It does not give advice. The figures are what was recorded, so they are as right as the recording, and a budget met here is not a guarantee of anything outside it.',
      'It is provided as it is, without warranty. If this copy is ever taken down, you will be told first — and because the source is public, the books can always be moved to a copy you run.',
    ],
  },
];

export default async function Terms() {
  const actor = await actorOrNull();
  const back = actor ? '/household' : '/signup';

  return (
    <Screen>
      <Back to={back} />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: BACK_SPACE }}>
        <header className="el2" style={{
          background: headerBg('slate'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 28px', display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <Link href={back} transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            Terms, and how your data is kept
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.82)' }}>
            Seven things, each one you can check. Dated {DATED}; if they change, the date does.
          </p>
        </header>

        <ol style={{ margin: 0, padding: '20px var(--gutter) 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SECTIONS.map((s) => (
            <li key={s.title} className="el card" style={{
              background: 'var(--c-card)', borderRadius: 18, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <h2 style={{ margin: 0, fontSize: 'var(--step-0)', fontWeight: 600, letterSpacing: '-.01em' }}>
                {s.title}
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.lines.map((line, i) => (
                  <li key={i} style={{
                    display: 'flex', gap: 10, fontSize: 'var(--step--1)', lineHeight: 1.55, color: 'var(--c-ink)',
                  }}>
                    <span aria-hidden style={{
                      width: 5, height: 5, flex: 'none', borderRadius: 999, marginTop: 8, background: 'var(--c-off)',
                    }} />
                    <span style={{ minWidth: 0 }}>{line}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p style={{
          margin: '18px var(--gutter) 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          Using the app means agreeing to these. Questions go to whoever sent you the link.
        </p>
      </main>
    </Screen>
  );
}

