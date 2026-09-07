'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { saveGeminiKey, removeGeminiKey } from './actions';

type Result = { ok: true; message?: string } | { ok: false; error: string };

export default function ScanKey({ hasKey, setOn }: { hasKey: boolean; setOn: string | null }) {
  const [saveState, save, saving] = useActionState(saveGeminiKey, null);
  const [rmState, remove, removing] = useActionState(
    async (p: Result | null) => removeGeminiKey(p), null);
  const [open, setOpen] = useState(false);

  return (
    <section className="el" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{
          width: 38, height: 38, flex: 'none', borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: hasKey ? 'var(--c-ok-tint)' : 'var(--c-sunk)',
          color: hasKey ? 'var(--c-ok)' : 'var(--c-meta)',
        }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4.5 8.5V6.8A2.3 2.3 0 0 1 6.8 4.5h1.7M15.5 4.5h1.7A2.3 2.3 0 0 1 19.5 6.8v1.7" />
            <path d="M19.5 15.5v1.7a2.3 2.3 0 0 1-2.3 2.3h-1.7M8.5 19.5H6.8a2.3 2.3 0 0 1-2.3-2.3v-1.7" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        </span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>Receipt scanning</span>
          <span style={{ fontSize: 'var(--step--1)', color: hasKey ? 'var(--c-ok)' : 'var(--c-meta)' }}>
            {hasKey ? `On since ${setOn}` : 'Off — needs a Google AI key'}
          </span>
        </span>
      </div>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{
          minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-ink)',
        }}>{hasKey ? 'Replace or remove the key' : 'Add a key'}</button>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
            Get one free at <b>aistudio.google.com/apikey</b>. It is yours, not ours: it is
            stored encrypted, only this household can use it, and every scan is billed to your
            own free quota rather than shared with strangers.
          </p>
          <form action={save} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Field label="API key" name="key" type="password" required autoFocus
              autoComplete="off" placeholder="AIza… or AQ.…" />
            {saveState && !saveState.ok && <ErrorNote>{saveState.error}</ErrorNote>}
            {saveState?.ok && (
              <p role="status" style={{
                margin: 0, padding: '11px 13px', borderRadius: 12, fontSize: 'var(--step--1)', fontWeight: 600,
                background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
              }}>{saveState.message}</p>
            )}
            <div style={{ display: 'flex', gap: 9 }}>
              <button type="button" onClick={() => setOpen(false)} style={{
                minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 'var(--step-0)',
                fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
              }}>Cancel</button>
              <button type="submit" disabled={saving} style={{
                flex: 1, minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Checking with Google…' : 'Check and save'}</button>
            </div>
            <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
              The key is tried against Google before it is stored, so a typo is caught now
              rather than the first time you photograph a receipt.
            </span>
          </form>

          {hasKey && (
            <form action={remove}>
              <button type="submit" disabled={removing} style={{
                width: '100%', minHeight: 46, borderRadius: 12, fontSize: 'var(--step--1)', fontWeight: 600,
                background: 'transparent', color: 'var(--c-danger)',
              }}>{removing ? 'Removing…' : 'Remove the key and turn scanning off'}</button>
              {rmState && !rmState.ok && <ErrorNote>{rmState.error}</ErrorNote>}
            </form>
          )}
        </>
      )}
    </section>
  );
}
