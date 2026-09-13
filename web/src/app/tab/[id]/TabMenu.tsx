'use client';

import { useActionState, useCallback, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import Sheet from '../../Sheet';
import { useMoney } from '@/app/currency';
import { deleteTab, renameTab, toggleTabClosed } from '../actions';

/* A tab's settings, behind the dots in its header: rename, close or reopen,
   delete. Kept off the screen itself because they are done once in a tab's
   life, and the screen belongs to what is owed on it. */
export default function TabMenu({ tabId, name, note, closed, held }: {
  tabId: string; name: string; note: string | null; closed: boolean; held: number;
}) {
  const { format } = useMoney();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'rename' | 'delete'>('menu');
  const close = useCallback(() => { setOpen(false); setView('menu'); }, []);
  /* The drawer shuts when the change lands, from the action itself rather
     than an effect watching its result. */
  const [renamed, rename, renaming] = useActionState(async (prev: Awaited<ReturnType<typeof renameTab>> | null, fd: FormData) => {
    const r = await renameTab(prev, fd);
    if (r.ok) close();
    return r;
  }, null);
  const [toggled, toggle, toggling] = useActionState(async (prev: Awaited<ReturnType<typeof toggleTabClosed>> | null, fd: FormData) => {
    const r = await toggleTabClosed(prev, fd);
    if (r.ok) close();
    return r;
  }, null);
  const [removed, remove, removing] = useActionState(deleteTab, null);

  const row = (icon: string, label: string, sub: string, onClick?: () => void, tone?: string) => (
    <button type={onClick ? 'button' : 'submit'} onClick={onClick} style={{
      width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12,
      color: tone ?? 'var(--c-ink)', borderBottom: '1px solid var(--c-rule)',
    }}>
      <span style={{
        width: 36, height: 36, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--c-sunk)',
      }}><Icon name={icon} size={18} strokeWidth={2} /></span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      <button type="button" aria-label="Tab settings" onClick={() => { haptic('tap'); setOpen(true); }} style={{
        width: 44, height: 44, marginRight: -11, borderRadius: 999, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
      }}>
        <Icon name="dots" size={22} strokeWidth={2} />
      </button>

      <Sheet open={open} onClose={close} label="Tab settings">
        {view === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
            <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600, marginBottom: 6 }}>{name}</h2>
            {row('pencil', 'Rename', 'The name and a note', () => setView('rename'))}
            <form action={toggle}>
              <input type="hidden" name="tabId" value={tabId} />
              {row(closed ? 'folder' : 'check', toggling ? 'Saving…' : closed ? 'Reopen this tab' : 'Close this tab',
                closed ? 'Offer it again when adding a cost' : 'Files it away. Nothing anyone owes changes.')}
            </form>
            {row('trash', 'Delete this tab', 'Asks first', () => setView('delete'), 'var(--c-danger)')}
            {toggled && !toggled.ok && <ErrorNote>{toggled.error}</ErrorNote>}
          </div>
        )}

        {view === 'rename' && (
          <form action={rename} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 2 }}>
            <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>Rename</h2>
            <input type="hidden" name="tabId" value={tabId} />
            <Field label="Name" name="name" defaultValue={name} required maxLength={60} autoFocus />
            <Field label="Note · optional" name="note" defaultValue={note ?? ''} maxLength={200} />
            {renamed && !renamed.ok && <ErrorNote>{renamed.error}</ErrorNote>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="cta" type="button" onClick={() => setView('menu')} style={{
                minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)',
                fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
              }}>Back</button>
              <button className="cta" type="submit" disabled={renaming} style={{
                flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: renaming ? 0.65 : 1,
              }}>{renaming ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        )}

        {view === 'delete' && (
          <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 2 }}>
            <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>Delete {name}?</h2>
            <input type="hidden" name="tabId" value={tabId} />
            <p style={{ margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
              Only the tab goes. Its entries stay in the books, and what each person owes for them stays owed.
              {held > 0 && <> What the tab itself is owed — <b>{format(held)}</b>, with nobody named — is written off.</>}
            </p>
            {removed && !removed.ok && <ErrorNote>{removed.error}</ErrorNote>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="cta" type="button" onClick={() => setView('menu')} style={{
                minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)',
                fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
              }}>Keep it</button>
              <button className="cta" type="submit" disabled={removing} style={{
                flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
                background: 'var(--c-danger-tint)', color: 'var(--c-danger)', opacity: removing ? 0.65 : 1,
              }}>{removing ? 'Deleting…' : 'Delete the tab'}</button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
