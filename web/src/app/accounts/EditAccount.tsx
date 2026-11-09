'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, ErrorNote } from '../auth-ui';
import { haptic } from '../haptics';
import { Icon } from '../Icon';
import SwipeRow from '../SwipeRow';
import { editAccount, archiveAccount } from './actions';
import CardIdentityFields from './CardIdentityFields';
import { bankFromName } from '@/lib/card-brand';
import { startPending } from '../pending';
import { OwnerSelect } from '../worth/fields';
import { keepFields } from '../form-hooks';
import { Info, ghost, solid, rowRule, rulePad, ruleSwipe } from '../form-bits';

/* Tap the row and it becomes its own form; save and it becomes a row again.
   The same move as a category, because a person who has learnt one should
   already know the other. */

export type Editable = {
  id: string; name: string; kind: string; last4: string | null;
  bank_key: string | null; card_network: string | null;
  /** Minor units, signed as stored: negative for a card that owed money. */
  opening: number;
  limit: number | null; statement_day: number | null; due_day: number | null;
  /** Live payment methods drawing on it — what stands between it and Archive. */
  methods: number;
  /** Whose it is as stored: a member id (perhaps someone who has left), or null for joint. */
  owner: string | null;
  /** Who it could belong to: the household's members. */
  owners: { id: string; name: string }[];
};

const rupees = (minor: number) => {
  const abs = Math.abs(minor);
  return abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
};

export default function EditAccount({ account, canWrite, last, block = false, children }: {
  account: Editable; canWrite: boolean; last: boolean; block?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  /* A row: its chip, the words (which wrap rather than cut off) and the balance. Hairlines between rows. */
  const shape = `relative ${block ? 'flex flex-col gap-2.5 py-4' : 'flex min-h-[76px] items-center gap-3 py-3'} ${last ? '' : `${rowRule} [--rule-x:50px] ${canWrite ? ruleSwipe : rulePad}`}`;

  if (!canWrite) return <div className={shape}>{children}</div>;

  if (!open) {
    /* A swipe offers the two things done to an account: move money in or
       out of it (a card gets paid, a bank pays), and change its details. */
    const credit = account.kind === 'credit';
    const move = credit ? `/add?kind=transfer&to=${account.id}` : `/add?kind=transfer&from=${account.id}`;
    return (
      <SwipeRow actions={[
        { label: 'Edit', icon: <Icon name="pencil" size={20} />, act: () => setOpen(true) },
        { label: credit ? 'Pay it' : 'Move', tone: 'primary',
          icon: <Icon name="move" size={20} />,
          act: () => { startPending(move); router.push(move); } },
        { label: 'Reconcile', icon: <Icon name="check" size={20} />,
          act: () => { startPending(`/accounts/${account.id}/reconcile`); router.push(`/accounts/${account.id}/reconcile`); } },
      ]} commit={false}>
        <button type="button" onClick={() => { haptic('select'); setOpen(true); }}
          aria-label={`Edit ${account.name}`} className={`${shape} w-full text-left text-foreground`}>
          {children}
        </button>
      </SwipeRow>
    );
  }
  return <AccountForm account={account} last={last} onDone={() => setOpen(false)} />;
}

/** The account's own form, on its own. `EditAccount` swaps a row for it, and
 *  the card deck opens it under a card face — same fields, same server action,
 *  so an account is edited in one place however you reached it. */
export function AccountForm({ account: a, last = true, onDone }: {
  account: Editable; last?: boolean; onDone: () => void;
}) {
  const credit = a.kind === 'credit';
  /* The server does the saving; this only decides what the fingertip feels
     and whether the form is still needed afterwards. */
  const [state, act, pending] = useActionState(async (_prev: unknown, fd: FormData) => {
    const r = await editAccount(null, fd);
    if (r.ok) { haptic('success'); onDone(); } else { haptic('warn'); }
    return r;
  }, null);
  const [retireState, retire, retiring] = useActionState(archiveAccount, null);
  const [sure, setSure] = useState(false);

  return (
    <div className={`relative flex flex-col gap-3.5 py-4 ${last ? '' : `${rowRule} ${rulePad} [--rule-x:0px]`}`}>
      {/* JS-only: this form replaces the row only after a tap, so the client closure loses no no-JS path. */}
      <form onSubmit={keepFields(act)} aria-label={`Edit ${a.name}`} className="flex flex-col gap-3.5">
        <input type="hidden" name="id" value={a.id} />
        <Field label="Name" name="name" required maxLength={60} defaultValue={a.name} autoFocus />
        {a.kind !== 'cash' && (
          <Field label={credit ? 'Last four digits' : 'Last four digits (optional)'} name="last4" inputMode="numeric"
            maxLength={4} defaultValue={a.last4 ?? ''} placeholder="8802" required={credit} />
        )}
        {credit ? (
          <>
            <CardIdentityFields bank={a.bank_key ?? bankFromName(a.name)?.key}
              network={a.card_network} />
            <Field label="Owed before the first entry" name="opening" inputMode="decimal"
              defaultValue={rupees(a.opening)}
              hint="What the card already owed when you started keeping it here. Everything since is worked out from the entries." />
            <Field label="Credit limit (optional)" name="limit" inputMode="decimal"
              defaultValue={a.limit ? rupees(a.limit) : ''} placeholder="200000" />
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Statement day" name="statement_day" inputMode="numeric" required
                maxLength={2} defaultValue={a.statement_day ?? ''} />
              <Field label="Bill due day" name="due_day" inputMode="numeric" required
                maxLength={2} defaultValue={a.due_day ?? ''} />
            </div>
            <Info>
              Change the statement day and purchases on bills you have not paid yet are
              re-filed into the right cycle. Paid bills stay as they were.
            </Info>
          </>
        ) : (
          <Field label="Balance before the first entry" name="opening" inputMode="decimal"
            defaultValue={rupees(a.opening)}
            hint="What it held when you started keeping it here. Today's balance is this plus every entry since — so if the balance on screen is wrong, this is the number to correct." />
        )}
        {/* Whose it is, for each person's net worth on Wealth. A person's account (money lent) never has an
            owner — it is the household's — and is never edited here anyway. */}
        {a.kind !== 'person' && <OwnerSelect members={a.owners} defaultValue={a.owner} keepUnlessChanged />}
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className={ghost}>Cancel</button>
          <button type="submit" disabled={pending} className={solid}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {/* Archive, never delete. Entries keep pointing at it, so the months it
          appears in still add up — which is the entire reason archived_at exists. */}
      <form action={retire} onSubmit={(e) => { if (!sure) { e.preventDefault(); setSure(true); } }}
        className="flex flex-col gap-1.5">
        <input type="hidden" name="id" value={a.id} />
        <button type="submit" disabled={retiring}
          className={`press flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-body font-semibold text-destructive disabled:opacity-60 ${sure ? 'bg-destructive/10' : ''}`}>
          <Icon name="archive" size={18} />
          {retiring ? 'Archiving…' : sure ? `Yes, archive ${a.name}` : 'Archive this account'}
        </button>
        {retireState && !retireState.ok && <ErrorNote>{retireState.error}</ErrorNote>}
        <span className="text-footnote leading-snug text-muted-foreground">
          {a.methods > 0
            ? `${a.methods === 1 ? 'One way to pay is' : `${a.methods} ways to pay are`} linked to this — archive ${a.methods === 1 ? 'it' : 'them'} first.`
            : 'It leaves the pickers. Every entry already on it stays, and no month changes value.'}
        </span>
      </form>
    </div>
  );
}
