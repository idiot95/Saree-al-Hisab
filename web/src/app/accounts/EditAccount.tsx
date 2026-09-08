'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, ErrorNote } from '../auth-ui';
import { haptic } from '../haptics';
import { Icon } from '../Icon';
import SwipeRow from '../SwipeRow';
import { editAccount, archiveAccount } from './actions';

/* Tap the row and it becomes its own form; save and it becomes a row again.
   The same move as a category, because a person who has learnt one should
   already know the other. */

export type Editable = {
  id: string; name: string; kind: string; last4: string | null;
  /** Minor units, signed as stored: negative for a card that owed money. */
  opening: number;
  limit: number | null; statement_day: number | null; due_day: number | null;
  /** Live payment methods drawing on it — what stands between it and Archive. */
  methods: number;
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
  const shape: React.CSSProperties = block
    ? { display: 'flex', flexDirection: 'column', gap: 10, padding: '15px 0' }
    : { display: 'flex', alignItems: 'center', gap: 12, minHeight: 76 };
  const rule = last ? undefined : '1px solid var(--c-rule)';

  if (!canWrite) return <div style={{ ...shape, borderBottom: rule }}>{children}</div>;

  if (!open) {
    /* A swipe offers the two things done to an account: move money in or
       out of it (a card gets paid, a bank pays), and change its details. */
    const credit = account.kind === 'credit';
    const move = credit ? `/add?kind=transfer&to=${account.id}` : `/add?kind=transfer&from=${account.id}`;
    return (
      <SwipeRow actions={[
        { label: 'Edit', icon: <Icon name="pencil" size={20} strokeWidth={2} />, act: () => setOpen(true) },
        { label: credit ? 'Pay it' : 'Move', tone: 'primary',
          icon: <Icon name="move" size={20} strokeWidth={2} />,
          act: () => router.push(move, { transitionTypes: ['nav-forward'] }) },
      ]}>
        <button type="button" onClick={() => { haptic('select'); setOpen(true); }}
          aria-label={`Edit ${account.name}`}
          style={{ ...shape, width: '100%', textAlign: 'left', borderBottom: rule, color: 'inherit' }}>
          {children}
        </button>
      </SwipeRow>
    );
  }
  return <Panel account={account} last={last} onDone={() => setOpen(false)} />;
}

function Panel({ account: a, last, onDone }: { account: Editable; last: boolean; onDone: () => void }) {
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
    <div style={{
      padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 13,
      borderBottom: last ? undefined : '1px solid var(--c-rule)',
    }}>
      <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <input type="hidden" name="id" value={a.id} />
        <Field label="Name" name="name" required maxLength={60} defaultValue={a.name} autoFocus />
        {a.kind !== 'cash' && (
          <Field label="Last four digits (optional)" name="last4" inputMode="numeric"
            maxLength={4} defaultValue={a.last4 ?? ''} placeholder="8802" />
        )}
        {credit ? (
          <>
            <Field label="Owed before the first entry" name="opening" inputMode="decimal"
              defaultValue={rupees(a.opening)}
              hint="What the card already owed when you started keeping it here. Everything since is worked out from the entries." />
            <Field label="Credit limit (optional)" name="limit" inputMode="decimal"
              defaultValue={a.limit ? rupees(a.limit) : ''} placeholder="200000" />
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ flex: 1 }}>
                <Field label="Statement day" name="statement_day" inputMode="numeric" required
                  maxLength={2} defaultValue={a.statement_day ?? ''} />
              </span>
              <span style={{ flex: 1 }}>
                <Field label="Bill due day" name="due_day" inputMode="numeric" required
                  maxLength={2} defaultValue={a.due_day ?? ''} />
              </span>
            </div>
            <p style={{
              margin: 0, padding: '11px 13px', borderRadius: 12, background: 'var(--c-teal-l)',
              color: 'var(--c-ink)', fontSize: 'var(--step--1)', lineHeight: 1.5,
            }}>
              Change the statement day and purchases on bills you have not paid yet are
              re-filed into the right cycle. Paid bills stay as they were.
            </p>
          </>
        ) : (
          <Field label="Balance before the first entry" name="opening" inputMode="decimal"
            defaultValue={rupees(a.opening)}
            hint="What it held when you started keeping it here. Today's balance is this plus every entry since — so if the balance on screen is wrong, this is the number to correct." />
        )}
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" onClick={onDone} style={ghost}>Cancel</button>
          <button type="submit" disabled={pending} style={{ ...solid, opacity: pending ? .65 : 1 }}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {/* Archive, never delete. Entries keep pointing at it, so the months it
          appears in still add up — which is the entire reason archived_at exists. */}
      <form action={retire} onSubmit={(e) => { if (!sure) { e.preventDefault(); setSure(true); } }}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input type="hidden" name="id" value={a.id} />
        <button className="cta" type="submit" disabled={retiring} style={{
          minHeight: 44, borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
          background: sure ? 'var(--c-danger-tint)' : 'transparent', color: 'var(--c-danger)',
        }}>
          {retiring ? 'Archiving…' : sure ? `Yes, archive ${a.name}` : 'Archive this account'}
        </button>
        {retireState && !retireState.ok && (
          <span role="alert" style={{ fontSize: 'var(--step--1)', color: 'var(--c-danger)' }}>
            {retireState.error}
          </span>
        )}
        <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          {a.methods > 0
            ? `${a.methods === 1 ? 'One way to pay is' : `${a.methods} ways to pay are`} linked to this — archive ${a.methods === 1 ? 'it' : 'them'} first.`
            : 'It leaves the pickers. Every entry already on it stays, and no month changes value.'}
        </span>
      </form>
    </div>
  );
}

const ghost: React.CSSProperties = {
  minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
  background: 'var(--c-sunk)', color: 'var(--c-meta)',
};
const solid: React.CSSProperties = {
  flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
  background: 'var(--g-primary)', color: 'var(--c-on-primary)',
};
