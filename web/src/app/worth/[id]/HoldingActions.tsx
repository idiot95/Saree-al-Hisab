'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Slot } from 'radix-ui';
import BottomDrawer from '../../BottomDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import { useMoney } from '../../currency';
import { addHoldingPhotos, archiveHolding, setRateOverride, updateSnapshot, type Result } from '../actions';
import { PhotoField, withPhotos } from '../PhotoField';
import { Field, Problem } from '../fields';
import { keepFields } from '../../form-hooks';
import { replacing } from '../../backStack';

/* What can be done to one holding. Each drawer posts to its server action, says what went wrong in a
   sentence if it did, and on success closes and refreshes the page — so the value on the card rolls to its new
   figure (Figure keeps its place across the refresh). */

function useSheet<T extends (prev: Result | null, fd: FormData) => Promise<Result>>(action: T, prep?: (fd: FormData) => FormData) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, act, pending] = useActionState(async (_: Result | null, fd: FormData) => {
    const r = await action(null, prep ? prep(fd) : fd);
    if (r.ok) { haptic('success'); setOpen(false); router.refresh(); } else haptic('warn');
    return r;
  }, null);
  return { open, setOpen, state, act, pending };
}

function Sheet({ open, setOpen, trigger, title, children }: {
  open: boolean; setOpen: (o: boolean) => void; trigger: React.ReactNode; title: string; children: React.ReactNode;
}) {
  /* The app's BottomDrawer (86dvh, the Close grip, focus back to the trigger); the trigger is the caller's button. */
  return (
    <>
      <Slot.Root aria-haspopup="dialog" onClick={() => { haptic('tap'); setOpen(true); }}>{trigger}</Slot.Root>
      <BottomDrawer open={open} onClose={() => setOpen(false)} label={title} showTitle>
        {children}
      </BottomDrawer>
    </>
  );
}

const action = 'press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-body font-semibold';

export function UpdateBalance({ id, fx, currency }: { id: string; fx: boolean; currency: string | null }) {
  const [files, setFiles] = useState<File[]>([]);
  const s = useSheet(updateSnapshot, (fd) => withPhotos(fd, files));
  return (
    <Sheet open={s.open} setOpen={(o) => { s.setOpen(o); if (!o) setFiles([]); }} title="Update balance"
      trigger={<button type="button" className={`${action} bg-primary text-primary-foreground`}><Icon name="edit" size={19} />Update balance</button>}>
      {/* JS-only on purpose: the drawer cannot open without script, so wrapping the action in a client closure loses no no-JS path. */}
      <form noValidate onSubmit={keepFields(s.act)} className="flex flex-col gap-4 pt-4">
        <input type="hidden" name="id" value={id} />
        <Field label={fx ? `Balance today, in ${currency}` : 'Weight today, in grams'} name="quantity" inputMode="decimal" required
          autoFocus hint={fx ? 'The whole balance, not the change.' : 'The whole weight, not the change. Up to three decimals.'} />
        <PhotoField files={files} onChange={setFiles} />
        {s.state && !s.state.ok && <Problem>{s.state.error}</Problem>}
        <Button type="submit" disabled={s.pending} className="h-12 rounded-xl text-headline font-semibold">
          {s.pending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Sheet>
  );
}

export function AddPhotos({ holdingId }: { holdingId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const s = useSheet(addHoldingPhotos, (fd) => withPhotos(fd, files));
  return (
    <Sheet open={s.open} setOpen={(o) => { s.setOpen(o); if (!o) setFiles([]); }} title="Add photos"
      trigger={<button type="button" className={`${action} border border-border bg-card`}><Icon name="add_photo_alternate" size={19} />Add photos</button>}>
      {/* JS-only on purpose: the drawer cannot open without script, so wrapping the action in a client closure loses no no-JS path. */}
      <form noValidate onSubmit={keepFields(s.act)} className="flex flex-col gap-4 pt-4">
        <input type="hidden" name="holdingId" value={holdingId} />
        <p className="text-subhead text-muted-foreground">Kept with the holding itself. A photo for one day’s figure goes in with Update balance.</p>
        <PhotoField files={files} onChange={setFiles} />
        {s.state && !s.state.ok && <Problem>{s.state.error}</Problem>}
        <Button type="submit" disabled={s.pending || files.length === 0} className="h-12 rounded-xl text-headline font-semibold">
          {s.pending ? 'Attaching…' : 'Attach'}
        </Button>
      </form>
    </Sheet>
  );
}

/* "1 USD = ₹84.00 · 6 Nov · Tap to override". A rate the household sets wins over the fetched one for that
   day and after, until a newer fetched one arrives. Viewers see the line without the tap. */
export function RateLine({ base, subject, rate, stale, canWrite, fx }: {
  base: string; subject: string; rate: string | null; stale: string | null; canWrite: boolean; fx: boolean;
}) {
  const { symbol } = useMoney();
  const s = useSheet(setRateOverride);
  const body = (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
      <span className="text-body tabular-nums [overflow-wrap:anywhere]">{rate ?? 'No rate yet'}</span>
      {stale && <span className="flex items-center gap-1 text-footnote text-attention-soft-foreground"><Icon name="sync_problem" size={15} />{stale}</span>}
      {canWrite && <span className="text-footnote text-muted-foreground">{rate ? 'Tap to override' : 'Tap to set one'}</span>}
    </span>
  );
  if (!canWrite) {
    return <div className="flex min-h-14 items-center gap-3 rounded-[18px] bg-card px-3.5 py-2.5"><Icon name="currency_exchange" size={22} className="text-primary" />{body}</div>;
  }
  return (
    <Sheet open={s.open} setOpen={s.setOpen} title={fx ? `Your rate for ${subject}` : `Your rate for ${subject.toLowerCase()}`}
      trigger={
        <button type="button" className="press flex min-h-14 w-full items-center gap-3 rounded-[18px] bg-card px-3.5 py-2.5">
          <Icon name="currency_exchange" size={22} className="text-primary" />{body}<Icon name="edit" size={18} className="text-muted-foreground" />
        </button>
      }>
      {/* JS-only on purpose: the drawer cannot open without script, so wrapping the action in a client closure loses no no-JS path. */}
      <form noValidate onSubmit={keepFields(s.act)} className="flex flex-col gap-4 pt-4">
        <input type="hidden" name="base" value={base} />
        <Field label={fx ? `${symbol.trim()} for 1 ${subject}` : `${symbol.trim()} for 1 g of pure ${subject.toLowerCase()}`}
          name="rate" inputMode="decimal" required autoFocus
          hint={fx ? 'Used from today until a newer rate is fetched.' : 'Per gram of pure metal; purity is applied for you. Used from today until a newer rate is fetched.'} />
        {s.state && !s.state.ok && <Problem>{s.state.error}</Problem>}
        <Button type="submit" disabled={s.pending} className="h-12 rounded-xl text-headline font-semibold">
          {s.pending ? 'Saving…' : 'Save rate'}
        </Button>
      </form>
    </Sheet>
  );
}

/* Archive, never delete: the history stays and it stops counting. The first tap only asks. */
export function ArchiveHolding({ id, name }: { id: string; name: string }) {
  const [sure, setSure] = useState(false);
  const router = useRouter();
  const [state, act, pending] = useActionState(async (_: Result | null, fd: FormData) => {
    const r = await archiveHolding(null, fd);
    if (r.ok) { haptic('success'); replacing('/worth'); router.replace('/worth'); } else haptic('warn');
    return r;
  }, null);
  return (
    // JS-only: the second tap and the redirect after it need script; the closure loses no no-JS path.
    <form onSubmit={(e) => { if (!sure) { e.preventDefault(); haptic('select'); setSure(true); return; } keepFields(act)(e); }}
      className="flex flex-col gap-1.5 pt-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending}
        className={`press flex min-h-12 items-center justify-center gap-2 rounded-xl text-body font-semibold text-destructive ${sure ? 'bg-destructive/10' : ''}`}>
        <Icon name="archive" size={19} />{pending ? 'Archiving…' : sure ? `Yes, archive ${name}` : 'Archive'}
      </button>
      {sure && !pending && (
        <button type="button" onClick={() => setSure(false)} className="min-h-11 text-subhead text-muted-foreground">Keep it</button>
      )}
      {state && !state.ok && <Problem>{state.error}</Problem>}
      <p className="text-center text-footnote text-muted-foreground">It stops counting. Its figures and photos are kept.</p>
    </form>
  );
}
