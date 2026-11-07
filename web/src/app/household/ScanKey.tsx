'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { saveGeminiKey, removeGeminiKey } from './actions';
import { Icon } from '../Icon';
import { Done, ghost, Glyph, solid, Words } from './rows';

type Result = { ok: true; message?: string } | { ok: false; error: string };

export default function ScanKey({ hasKey, setOn }: { hasKey: boolean; setOn: string | null }) {
  const [saveState, save, saving] = useActionState(saveGeminiKey, null);
  const [rmState, remove, removing] = useActionState(
    async (p: Result | null) => removeGeminiKey(p), null);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-[18px] bg-card p-[var(--pad)]">
      <div className="flex items-center gap-3">
        <Glyph name="photo_camera" tone={hasKey ? 'accent' : 'muted'} />
        <Words title="Receipt scanning"
          sub={<span className="inline-flex items-center gap-1">
            <Icon name={hasKey ? 'check_circle' : 'circle'} size={15} />
            {hasKey ? `On since ${setOn}` : 'Off — needs a Google AI key'}
          </span>} />
      </div>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-base font-semibold text-foreground">
          <Icon name="key" size={20} />{hasKey ? 'Replace or remove the key' : 'Add a key'}
        </button>
      ) : (
        <>
          <p className="text-sm leading-normal text-muted-foreground">
            Get one free at <b className="text-foreground">aistudio.google.com/apikey</b>. It is yours, not ours: it is
            stored encrypted, only this household can use it, and every scan is billed to your
            own free quota rather than shared with strangers.
          </p>
          <form action={save} className="flex flex-col gap-3">
            <Field label="API key" name="key" type="password" required autoFocus
              autoComplete="off" placeholder="AIza… or AQ.…" />
            {saveState && !saveState.ok && <ErrorNote>{saveState.error}</ErrorNote>}
            {saveState?.ok && <Done>{saveState.message}</Done>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
              <button type="submit" disabled={saving} className={solid}>
                {saving ? 'Checking with Google…' : 'Check and save'}
              </button>
            </div>
            <span className="text-xs leading-snug text-muted-foreground">
              The key is tried against Google before it is stored, so a typo is caught now
              rather than the first time you photograph a receipt.
            </span>
          </form>

          {hasKey && (
            <form action={remove} className="flex flex-col gap-2">
              <button type="submit" disabled={removing}
                className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-destructive disabled:opacity-60">
                <Icon name="delete" size={18} />{removing ? 'Removing…' : 'Remove the key and turn scanning off'}
              </button>
              {rmState && !rmState.ok && <ErrorNote>{rmState.error}</ErrorNote>}
            </form>
          )}
        </>
      )}
    </div>
  );
}
