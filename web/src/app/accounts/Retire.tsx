'use client';

import { useActionState, useState } from 'react';
import { archiveMethod, makeDefaultMethod } from './actions';

export function MethodControls({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [retireState, retire, retiring] = useActionState(archiveMethod, null);
  const [, setDefault] = useActionState(makeDefaultMethod, null);
  const [sure, setSure] = useState(false);

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', marginLeft: -8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isDefault ? (
          <span style={{
            fontSize: 'var(--step--2)', fontWeight: 700, padding: '5px 9px', borderRadius: 7,
            background: 'var(--accent)', color: 'var(--accent-foreground)', letterSpacing: '.03em', marginLeft: 8,
          }}>Default</span>
        ) : (
          <form action={setDefault}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" style={link}>Make default</button>
          </form>
        )}
        {sure ? (
          <form action={retire}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={retiring} style={{ ...link, color: 'var(--destructive)' }}>
              {retiring ? 'Archiving…' : 'Confirm'}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setSure(true)} style={link}>Archive</button>
        )}
      </span>
      {retireState && !retireState.ok && (
        <span role="alert" style={{ fontSize: 'var(--step--2)', color: 'var(--destructive)', maxWidth: 260, paddingLeft: 8 }}>
          {retireState.error}
        </span>
      )}
    </span>
  );
}

const link: React.CSSProperties = {
  minHeight: 44, padding: '0 8px', fontSize: 'var(--step--1)', fontWeight: 600,
  color: 'var(--muted-foreground)', background: 'transparent',
};
