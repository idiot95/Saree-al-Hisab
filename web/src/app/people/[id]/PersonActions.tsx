'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorNote as Problem } from '../../auth-ui';
import { Field } from '../../worth/fields';
import { Icon } from '../../Icon';
import { lend, recordRepayment, writeOff } from '../actions';
import { useMoney } from '@/app/currency';
import PayPicker from '../../PayPicker';
import CategoryPick from '../../CategoryPick';
import type { Category } from '../../CategoryFinder';
import { defaultRef, type Way } from '@/lib/pay';
import { fits } from '@/lib/scope';

/* Three actions, three shapes, and the copy says which is which — because the
   difference between them is the entire point. Lending and repayment move
   money without spending it. Writing off is the moment it becomes spending. */
export default function PersonActions({ personId, name, balance, ways, categories }: {
  personId: string; name: string; balance: number; ways: Way[]; categories: Category[];
}) {
  const { format, toKeys } = useMoney();
  const [mode, setMode] = useState<null | 'lend' | 'back' | 'off'>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [lendState, lendAct, lending] = useActionState(lend, null);
  const [backState, backAct, paying] = useActionState(recordRepayment, null);
  const [offState, offAct, forgiving] = useActionState(writeOff, null);

  if (mode === null) {
    return (
      <div className="mx-[var(--gutter)] flex flex-wrap gap-2">
        <Button type="button" onClick={() => setMode('lend')} className="h-[54px] flex-1 basis-40 rounded-2xl text-base font-semibold">
          <Icon name="payments" size={18} />Lend money
        </Button>
        <Button type="button" variant="outline" onClick={() => setMode('back')}
          className="h-[54px] flex-1 basis-40 rounded-2xl border-border bg-card text-base font-semibold dark:border-border dark:bg-card">
          <Icon name="receivable" size={18} />Got money back
        </Button>
      </div>
    );
  }

  const common = (
    <>
      <input type="hidden" name="personId" value={personId} />
      <Field label="Amount" name="amount" inputMode="decimal" required autoFocus placeholder="0" />
      <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
    </>
  );

  /* Page-level forms: each server action goes straight into useActionState, so the form posts without script. */
  return (
    <div className="mx-[var(--gutter)] rounded-[18px] bg-card p-4">
      {mode === 'lend' && (
        <form action={lendAct} className="flex flex-col gap-3">
          <Title>Lend to {name}</Title>
          <Explain>Not spending. The money moves from your account into theirs.</Explain>
          {common}
          <PayField label="How you sent it" ways={ways} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {lendState && !lendState.ok && <Problem>{lendState.error}</Problem>}
          <Row onCancel={() => setMode(null)} pending={lending} label="Record loan" />
        </form>
      )}

      {mode === 'back' && (
        <form action={backAct} className="flex flex-col gap-3">
          <Title>{name} paid you back</Title>
          <Explain>Not income either — it was never spending, so getting it back is not earning.</Explain>
          {common}
          <PayField label="How it came back" ways={ways} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {backState && !backState.ok && <Problem>{backState.error}</Problem>}
          <Row onCancel={() => setMode(null)} pending={paying} label="Record repayment" />
        </form>
      )}

      {mode === 'off' && (
        <form action={offAct} className="flex flex-col gap-3">
          <Title>Write off what {name} owes</Title>
          <Explain>
            This <b className="text-foreground">is</b> spending, counted in the month you forgive it. Until now the money was
            still yours; from here it has been spent.
          </Explain>
          <input type="hidden" name="personId" value={personId} />
          <Field label="Amount" name="amount" inputMode="decimal" required autoFocus
            defaultValue={balance > 0 ? toKeys(balance) : ''} />
          <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
          {/* A write-off is spending, so only a category for spending will do. */}
          <CategoryPick label="Count it under" name="categoryId"
            categories={categories.filter((c) => fits(c.scope, 'expense'))} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {offState && !offState.ok && <Problem>{offState.error}</Problem>}
          <Row onCancel={() => setMode(null)} pending={forgiving} label="Write it off" danger />
        </form>
      )}

      {mode !== 'off' && balance > 0 && (
        <Button type="button" variant="ghost" onClick={() => setMode('off')}
          className="mt-3 h-11 w-full font-semibold text-muted-foreground">
          Or write off the {format(balance)} they owe
        </Button>
      )}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold">{children}</h2>;
}
function Explain({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>;
}
function PayField({ label, ways }: { label: string; ways: Way[] }) {
  return (
    <div role="group" className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
    </div>
  );
}
function Row({ onCancel, pending, label, danger }: {
  onCancel: () => void; pending: boolean; label: string; danger?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" onClick={onCancel} className="h-12 rounded-xl px-4 text-base font-semibold">
        Cancel
      </Button>
      <Button type="submit" disabled={pending}
        className={`h-12 flex-1 rounded-xl text-base font-semibold ${danger ? 'bg-destructive/10 text-destructive hover:bg-destructive/15' : ''}`}>
        {pending ? 'Saving…' : label}
      </Button>
    </div>
  );
}
