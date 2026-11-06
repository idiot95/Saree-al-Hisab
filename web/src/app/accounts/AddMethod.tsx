'use client';

import { useActionState, useState } from 'react';
import { Icon, RAIL_ICON } from '../Icon';
import { Field, ErrorNote } from '../auth-ui';
import { addMethod } from './actions';
import { useKeepOnRefusal } from '../worth/fields';
import { AddRow, fieldLabel, formCard, ghost, selectCls, solid } from '../form-bits';

type Acc = { id: string; name: string; kind: string };

/* The rails a given account can carry, mirroring what the database will allow.
   Offering an impossible pairing and then refusing it is worse than not
   offering it: the person learns the rule by being told off. */
const RAILS = [
  { id: 'upi', label: 'UPI', hint: 'GPay, PhonePe, Paytm', on: ['spending', 'cash'] },
  { id: 'card', label: 'Card', hint: 'The card itself', on: ['credit'] },
  { id: 'netbanking', label: 'Net banking', hint: 'Direct from the bank', on: ['spending'] },
  { id: 'autodebit', label: 'Auto-debit', hint: 'Standing instruction', on: ['spending', 'credit'] },
  { id: 'cash', label: 'Cash', hint: 'Notes', on: ['cash', 'spending'] },
  { id: 'wallet', label: 'Wallet', hint: 'Paytm and similar', on: ['spending', 'cash'] },
  { id: 'cheque', label: 'Cheque', hint: '', on: ['spending'] },
] as const;

export default function AddMethod({ accounts, startOpen = false }: { accounts: Acc[]; startOpen?: boolean }) {
  const [state, act, pending] = useActionState(addMethod, null);
  // Page-level and no-JS capable (it opens itself when a way to pay is wanted), so it posts directly; a refusal's
  // reset is undone so "Takes money from" and the type stay as chosen.
  const keep = useKeepOnRefusal(state);
  const [open, setOpen] = useState(startOpen);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');

  const account = accounts.find((a) => a.id === accountId);
  const allowed = RAILS.filter((r) => account && (r.on as readonly string[]).includes(account.kind));

  if (!open) {
    return <AddRow onClick={() => setOpen(true)}>Add a way to pay — GPay, a debit card, net banking</AddRow>;
  }

  return (
    <form action={act} {...keep} aria-label="Add a way to pay" className={formCard}>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Takes money from</span>
        <select name="funding_account_id" value={accountId}
          onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="text-xs leading-snug text-muted-foreground">
          Spending on this method is recorded against this account.
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 ${fieldLabel}`}>Type</legend>
        <div className="flex flex-wrap gap-2">
          {allowed.map((r, i) => (
            <label key={r.id}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-accent">
              <input type="radio" name="kind" value={r.id} defaultChecked={i === 0}
                className="size-[17px] flex-none accent-primary" />
              <Icon name={RAIL_ICON[r.id]} size={18} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{r.label}</span>
                {r.hint && <span className="text-xs text-muted-foreground">{r.hint}</span>}
              </span>
            </label>
          ))}
        </div>
        {allowed.length === 0 && (
          <span className="text-sm text-muted-foreground">
            That account is a way to pay by itself — nothing else needs linking to it.
          </span>
        )}
      </fieldset>

      <Field label="Name" name="name" required maxLength={60} placeholder="GPay" />
      <Field label="Handle or reference (optional)" name="handle" maxLength={60}
        placeholder="you@okhdfc" />

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending || allowed.length === 0} className={solid}>
          {pending ? 'Saving…' : 'Add way to pay'}
        </button>
      </div>
    </form>
  );
}
