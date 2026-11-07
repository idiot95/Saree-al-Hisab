import { actorOrNull } from '@/db/queries';
import PageHead from '../PageHead';
import Screen from '../Screen';
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
const DATED = '6 November 2026';
const link = 'font-semibold text-primary underline underline-offset-[3px] [overflow-wrap:anywhere]';

const SECTIONS: { title: string; lines: React.ReactNode[] }[] = [
  {
    title: 'What this is',
    lines: [
      'A set of books for one household, kept by the people in it. Nothing is read from your bank, and nothing from your messages unless you set a phone up to forward them: every figure here is one that you or someone in your household typed, scanned or forwarded and then confirmed, or recorded from a schedule.',
      'You can keep more than one household, and belong to households other people opened. Each is its own set of books.',
    ],
  },
  {
    title: 'Who can see your books',
    lines: [
      'The members of your household, at the role its owner gave them, and no one else. No other household, no advertiser, no analytics service — none is connected.',
      'Someone who is invited sees the books only after they have opened the invitation and signed in with a Google account whose address is the one the invitation was sent to — or, only until the password window the person running this copy sets has closed, made a password account from it.',
      'Whoever runs this copy of the app can, in principle, reach the database it stores. That is true of every service that keeps anything for you, and it is worth saying plainly here rather than leaving you to assume.',
    ],
  },
  {
    title: 'How it is kept',
    lines: [
      'The books live in a Postgres database. The storage underneath it is encrypted at rest, and every connection to it is over TLS — the app refuses a plain one.',
      'You sign in with Google. If you have an older password, it is never stored as typed: what is kept is a salted scrypt hash, which is enough to check it and useless for recovering it. Password sign-in ends on a date the person running this copy sets, and the hashes are kept after it.',
      'A Google AI key you add for receipt scanning is encrypted with AES-256-GCM under a secret that exists only on the server. It is decrypted only to scan, and sent nowhere but Google.',
      'Every request checks, on the server, that you belong to the household you are asking about and that your role allows what you are doing. The database checks it again: the app connects to Postgres as a role that can only see the household a request is for, so a query cannot reach another household’s rows even by mistake. Sessions can be cut off: changing your password or tapping Sign out everywhere ends every other phone’s session on its next tap.',
      'Invitation and password-reset links carry a one-time token, expire, and are sent without a referrer so the address bar does not leak them to the next site.',
    ],
  },
  {
    title: 'What leaves your phone',
    lines: [
      'Entries go to the app’s own server and nowhere else. An entry saved without signal waits on the phone and goes when there is one.',
      'Signing in sends you to Google and back. Google learns that you signed in to this app, and when; it is not sent your entries or anything in your books. What the app keeps from Google is the account’s id and your email address as it was when you linked it, plus your name and picture if Google made your account here. It asks for no access to your Google data beyond that.',
      'If you turn on receipt scanning, the photo you scan goes to Google’s Gemini API under your own key and your own quota. Google is the third party for sign-in, and for scanning (and reading a forwarded bank message the server could not place) only when you have added that key.',
      'To value pots in other currencies and gold and silver, the server fetches public rates: exchange rates from open.er-api.com, and metal prices from api.gold-api.com. The request names only a currency code (your household’s currency) or a metal’s code (XAU, XAG), and comes from the server, not your phone. Nothing about you, your household or your books is sent with it.',
    ],
  },
  {
    title: 'Bank messages you forward',
    lines: [
      'SMS capture is off until you turn it on, phone by phone, under Household. A phone you set up sends the bank messages you chose to this app’s own server, with a key only that phone holds. The server keeps only a hash of the key, and you can revoke it at any time.',
      'A one-time password is recognised and dropped as it arrives: it is never stored. Every other message becomes a draft under To review, and nothing is recorded in your books until someone saves it.',
      'What is kept from a message is the figures read from it — amount, money in or out, the last four digits of the account, where, the date — and the sender’s name. Its full text is kept only until the draft is added or dismissed, or for 30 days if nobody does either; then it is deleted, and only those figures remain.',
      'The message is read on the app’s own server. Only when that cannot tell whether money came in or went out, and only if your household has added its own Gemini key, is the text also sent to Google’s Gemini API, under that key, to be read.',
    ],
  },
  {
    title: 'The source is public',
    lines: [
      <>The whole app is at <a href={REPO} className={link}>github.com/idiot95/Saree-al-Hisab</a>. You can read exactly what it does with your data rather than take this page’s word for it.</>,
      'You can also run your own copy against your own database. It needs a Postgres connection string, one secret and a Google OAuth client for sign-in; the README in the repository says how. Then nobody but you holds the books.',
    ],
  },
  {
    title: 'Your account',
    lines: [
      'Link Google, change a password, or sign every phone out, under Household. An owner can remove anyone from a household; the entries that person recorded stay, because they are the household’s record, not theirs.',
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
  /* The count is spelt out, as the copy always has been ("Seven things"), and follows the list. */
  const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: BACK_SPACE }}>
        <PageHead back={back} title="Terms, and how your data is kept"
          sub={`${COUNT[SECTIONS.length] ?? SECTIONS.length} things, each one you can check. Dated ${DATED}; if they change, the date does.`} />

        <div className="flex flex-col gap-4 px-[var(--gutter)] pb-8">
          <ol className="flex flex-col gap-3">
            {SECTIONS.map((s) => (
              <li key={s.title} className="flex flex-col gap-2.5 rounded-[18px] bg-card p-[var(--pad)]">
                <h2 className="text-headline font-semibold">{s.title}</h2>
                <ul className="flex flex-col gap-2">
                  {s.lines.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-body leading-relaxed">
                      <span aria-hidden className="mt-[0.7em] size-[5px] flex-none rounded-full bg-muted-foreground" />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <p className="px-0.5 text-subhead leading-normal text-muted-foreground">
            Using the app means agreeing to these. Questions go to whoever sent you the link.
          </p>
        </div>
      </main>
    </Screen>
  );
}
