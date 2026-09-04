'use client';

import { useActionState, useState } from 'react';
import { archiveAccount, archiveMethod, makeDefaultMethod } from './actions';

/* Archive, never delete. Entries keep pointing at it, so the months it appears
   in still add up — which is the entire reason archived_at exists. */
export function RetireAccount({ id, name, blocked }: { id: string; name: string; blocked: number }) {
  const [state, act, pending] = useActionState(archiveAccount, null);
  const [sure, setSure] = useState(false);

  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)} style={link}>
        Archive
      </button>
    );
  }
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <span style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setSure(false)} style={link}>Cancel</button>
        <form action={act}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={pending} style={{ ...link, color: 'var(--c-danger)' }}>
            {pending ? 'Archiving…' : `Archive ${name}`}
          </button>
        </form>
      </span>
      {blocked > 0 && (
        <span style={{ fontSize: 11.5, color: 'var(--c-meta)', textAlign: 'right', maxWidth: 210 }}>
          {blocked === 1 ? '1 payment method draws' : `${blocked} payment methods draw`} on this.
        </span>
      )}
      {state && !state.ok && (
        <span role="alert" style={{ fontSize: 11.5, color: 'var(--c-danger)', textAlign: 'right', maxWidth: 210 }}>
          {state.error}
        </span>
      )}
    </span>
  );
}

export function MethodControls({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [retireState, retire, retiring] = useActionState(archiveMethod, null);
  const [, setDefault] = useActionState(makeDefaultMethod, null);
  const [sure, setSure] = useState(false);

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isDefault ? (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 7,
            background: 'var(--c-ok-tint)', color: 'var(--c-ok)', letterSpacing: '.03em',
          }}>DEFAULT</span>
        ) : (
          <form action={setDefault}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" style={link}>Make default</button>
          </form>
        )}
        {sure ? (
          <form action={retire}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={retiring} style={{ ...link, color: 'var(--c-danger)' }}>
              {retiring ? 'Archiving…' : 'Confirm'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setSure(true)} style={link}>Archive</button>
        )}
      </span>
      {retireState && !retireState.ok && (
        <span role="alert" style={{ fontSize: 11.5, color: 'var(--c-danger)', textAlign: 'right', maxWidth: 220 }}>
          {retireState.error}
        </span>
      )}
    </span>
  );
}

const link: React.CSSProperties = {
  minHeight: 44, padding: '0 8px', fontSize: 12.5, fontWeight: 600,
  color: 'var(--c-meta)', background: 'transparent',
};
