'use client';

import { useActionState, useState } from 'react';
import { Chip, Icon, ACCOUNT_ICON, ACCOUNT_TINT } from '../Icon';
import { AddRow, Info, fieldLabel, formCard, ghost, solid } from '../form-bits';
import { Field, ErrorNote } from '../auth-ui';
import { addAccount } from './actions';
import CardIdentityFields from './CardIdentityFields';

const KINDS = [
  { id: 'spending', label: 'Bank account', what: 'Salary in, bills out.' },
  { id: 'cash', label: 'Cash', what: 'Notes in your wallet.' },
  { id: 'savings', label: 'Savings or deposit', what: 'Kept outside the monthly budget.' },
  { id: 'credit', label: 'Credit card', what: 'Tracks what you owe and when the bill is due.' },
] as const;

export default function AddAccount({ startOpen = false }: { startOpen?: boolean }) {
  const [state, act, pending] = useActionState(addAccount, null);
  const [open, setOpen] = useState(startOpen);
  const [kind, setKind] = useState<string>('spending');

  if (!open) {
    return (
      <AddRow onClick={() => setOpen(true)}
        done={state?.ok && state.message
          ? <span className="flex items-center gap-1 text-sm font-semibold text-primary"><Icon name="check" size={16} />Added</span>
          : null}>
        Add an account
      </AddRow>
    );
  }

  return (
    <form action={act} aria-label="Add an account" className={formCard}>
      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 ${fieldLabel}`}>Type</legend>
        {KINDS.map((k) => (
          <label key={k.id}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${kind === k.id ? 'border-primary bg-accent' : 'border-border bg-background'}`}>
            <input type="radio" name="kind" value={k.id} checked={kind === k.id}
              onChange={() => setKind(k.id)} className="mt-0.5 size-[19px] flex-none accent-primary" />
            <Chip icon={ACCOUNT_ICON[k.id]} tint={ACCOUNT_TINT[k.id]} size={34} radius={9} iconSize={17} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{k.label}</span>
              <span className="text-sm leading-snug text-muted-foreground">{k.what}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field label="Name" name="name" required maxLength={60}
        placeholder={kind === 'credit' ? 'HDFC Regalia' : kind === 'cash' ? 'Wallet' : 'HDFC Savings'} />

      {kind !== 'cash' && (
        <Field label={kind === 'credit' ? 'Last four digits' : 'Last four digits (optional)'}
          name="last4" inputMode="numeric" maxLength={4} placeholder="8802"
          required={kind === 'credit'} />
      )}

      {kind === 'credit' ? (
        <>
          <CardIdentityFields />
          <Field label="Currently owed" name="opening" inputMode="decimal" placeholder="0"
            hint="Leave at 0 if the bill is cleared." />
          <Field label="Credit limit (optional)" name="limit" inputMode="decimal" placeholder="200000" />
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Statement day" name="statement_day" inputMode="numeric"
              required placeholder="5" maxLength={2} />
            <Field label="Bill due day" name="due_day" inputMode="numeric"
              required placeholder="12" maxLength={2} />
          </div>
          <Info>
            Purchases on this card are filed into the right billing cycle automatically.
            Use a day between 1 and 28 &mdash; every month has one.
          </Info>
        </>
      ) : (
        <Field label="Current balance" name="opening" inputMode="decimal" placeholder="0" />
      )}

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending} className={solid}>{pending ? 'Saving…' : 'Add account'}</button>
      </div>
    </form>
  );
}
