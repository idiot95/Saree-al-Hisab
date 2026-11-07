'use client';

import { useActionState, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorNote as Problem } from '../../auth-ui';
import { Field } from '../../worth/fields';
import { keepFields } from '../../form-hooks';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import BottomDrawer from '../../BottomDrawer';
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

  const row = (icon: string, label: string, sub: string, onClick?: () => void, danger?: boolean) => (
    <button type={onClick ? 'button' : 'submit'} onClick={onClick}
      className={`press flex min-h-15 w-full items-center gap-3 border-b border-border text-left ${danger ? 'text-destructive' : 'text-foreground'}`}>
      <span className="grid size-9 flex-none place-items-center rounded-[10px] bg-muted"><Icon name={icon} size={18} /></span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );

  /* The three forms are in a drawer, which needs script to open: they submit through keepFields, so a refused
     rename keeps what was typed. */
  return (
    <>
      <button type="button" aria-label="Tab settings" onClick={() => { haptic('tap'); setOpen(true); }}
        className="press -mr-2.5 grid size-11 flex-none place-items-center rounded-full text-foreground in-data-[platform=android]:size-12">
        <Icon name="dots" size={22} />
      </button>

      <BottomDrawer open={open} onClose={close} label="Tab settings">
        {view === 'menu' && (
          <div className="flex flex-col pt-0.5">
            <h2 className="mb-1.5 text-xl font-bold">{name}</h2>
            {row('pencil', 'Rename', 'The name and a note', () => setView('rename'))}
            <form noValidate onSubmit={keepFields(toggle)}>
              <input type="hidden" name="tabId" value={tabId} />
              {row(closed ? 'folder' : 'check', toggling ? 'Saving…' : closed ? 'Reopen this tab' : 'Close this tab',
                closed ? 'Offer it again when adding a cost' : 'Files it away. Nothing anyone owes changes.')}
            </form>
            {row('trash', 'Delete this tab', 'Asks first', () => setView('delete'), true)}
            {toggled && !toggled.ok && <div className="pt-3"><Problem>{toggled.error}</Problem></div>}
          </div>
        )}

        {view === 'rename' && (
          <form noValidate onSubmit={keepFields(rename)} className="flex flex-col gap-3 pt-0.5">
            <h2 className="text-xl font-bold">Rename</h2>
            <input type="hidden" name="tabId" value={tabId} />
            <Field label="Name" name="name" defaultValue={name} required maxLength={60} autoFocus />
            <Field label="Note · optional" name="note" defaultValue={note ?? ''} maxLength={200} />
            {renamed && !renamed.ok && <Problem>{renamed.error}</Problem>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setView('menu')}
                className="h-12 rounded-xl px-4 text-base font-semibold">Back</Button>
              <Button type="submit" disabled={renaming} className="h-12 flex-1 rounded-xl text-base font-semibold">
                {renaming ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        )}

        {view === 'delete' && (
          <form noValidate onSubmit={keepFields(remove)} className="flex flex-col gap-3 pt-0.5">
            <h2 className="text-xl font-bold">Delete {name}?</h2>
            <input type="hidden" name="tabId" value={tabId} />
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Only the tab goes. Its entries stay in the books, and what each person owes for them stays owed.
              {held > 0 && <> What the tab itself is owed — <b className="text-foreground">{format(held)}</b>, with nobody named — is written off.</>}
            </p>
            {removed && !removed.ok && <Problem>{removed.error}</Problem>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setView('menu')}
                className="h-12 rounded-xl px-4 text-base font-semibold">Keep it</Button>
              <Button type="submit" disabled={removing}
                className="h-12 flex-1 rounded-xl bg-destructive/10 text-base font-semibold text-destructive hover:bg-destructive/15">
                <Icon name="trash" size={18} />
                {removing ? 'Deleting…' : 'Delete the tab'}
              </Button>
            </div>
          </form>
        )}
      </BottomDrawer>
    </>
  );
}
