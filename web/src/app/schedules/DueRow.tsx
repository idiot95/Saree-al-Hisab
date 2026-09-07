'use client';

import { useActionState, useState } from 'react';
import { Icon } from '../Icon';
import { recordDue, skipDue, archiveSchedule } from './actions';
import { format } from '@/lib/money';

export default function DueRow({
  scheduleId, name, dueOn, daysAway, amount, category, icon, tint,
}: {
  scheduleId: string; name: string; dueOn: string; daysAway: number;
  amount: number; category: string | null; icon?: string | null; tint?: string | null;
}) {
  const [recState, record, recording] = useActionState(recordDue, null);
  const [, skip] = useActionState(skipDue, null);
  const [open, setOpen] = useState(false);
  const overdue = daysAway < 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0',
      borderBottom: '1px solid var(--c-rule)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: overdue ? 'var(--c-danger-tint)' : 'var(--c-warn-tint)',
          color: overdue ? 'var(--c-danger)' : 'var(--c-warn)',
        }}>
          <Icon name={icon ?? 'autodebit'} size={19} strokeWidth={1.9} />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
          <span style={{ fontSize: 12.5, color: overdue ? 'var(--c-danger)' : 'var(--c-meta)' }}>
            {overdue ? `${-daysAway} days overdue`
              : daysAway === 0 ? 'due today' : `due in ${daysAway} days`}
            {category && ` · ${category}`}
          </span>
        </span>
        <span className="t" style={{ fontSize: 16.5 }}>{format(amount)}</span>
      </div>

      {!open ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setOpen(true)} style={{
            flex: 1, minHeight: 44, borderRadius: 11, fontSize: 13.5, fontWeight: 600,
            background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
          }}>Record it</button>
          <form action={skip}>
            <input type="hidden" name="scheduleId" value={scheduleId} />
            <input type="hidden" name="dueOn" value={dueOn} />
            <button type="submit" style={{
              minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 13.5,
              fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>Skip</button>
          </form>
        </div>
      ) : (
        <form action={record} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <input type="hidden" name="dueOn" value={dueOn} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
              Amount — change it if this month differed
            </span>
            <input name="amount" inputMode="decimal" defaultValue={String(amount / 100)}
              style={{
                minHeight: 48, borderRadius: 12, border: '1px solid var(--c-border)',
                background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 16,
                fontWeight: 600, padding: '0 12px',
              }} />
          </label>
          {recState && !recState.ok && (
            <span role="alert" style={{ fontSize: 12.5, color: 'var(--c-danger)' }}>
              {recState.error}
            </span>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              minHeight: 46, padding: '0 14px', borderRadius: 11, fontSize: 13.5,
              fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>Cancel</button>
            <button type="submit" disabled={recording} style={{
              flex: 1, minHeight: 46, borderRadius: 11, fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
              opacity: recording ? 0.6 : 1,
            }}>{recording ? 'Saving…' : 'Record the payment'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function StopSchedule({ scheduleId, name }: { scheduleId: string; name: string }) {
  const [state, act, pending] = useActionState(archiveSchedule, null);
  const [sure, setSure] = useState(false);

  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)} style={quiet}>Stop</button>
    );
  }
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button type="button" onClick={() => setSure(false)} style={quiet}>Keep</button>
      <form action={act}>
        <input type="hidden" name="scheduleId" value={scheduleId} />
        <button type="submit" disabled={pending} style={{ ...quiet, color: 'var(--c-danger)' }}>
          {pending ? 'Stopping…' : `Stop ${name}`}
        </button>
      </form>
      {state && !state.ok && (
        <span role="alert" style={{ fontSize: 11.5, color: 'var(--c-danger)' }}>{state.error}</span>
      )}
    </span>
  );
}

const quiet: React.CSSProperties = {
  minHeight: 44, padding: '0 9px', fontSize: 12.5, fontWeight: 600,
  color: 'var(--c-meta)', background: 'transparent',
};
