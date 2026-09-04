'use client';

import { useActionState } from 'react';
import { revokeInvite } from './actions';

export default function RevokeButton({ id }: { id: string }) {
  const [state, act, pending] = useActionState(revokeInvite, null);

  return (
    <form action={act} style={{ flex: 'none' }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} title={state && !state.ok ? state.error : undefined}
        style={{
          minHeight: 44, padding: '0 13px', borderRadius: 11, fontSize: 13.5, fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-danger)',
        }}>
        {pending ? 'Changing the locks…' : 'Withdraw it'}
      </button>
    </form>
  );
}
