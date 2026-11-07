'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomDrawer from '../BottomDrawer';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { CURRENCIES } from '@/lib/money';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import { chip, chipOff, chipRow } from '../form-bits';
import { createHolding, type Result } from './actions';
import { PhotoField, withPhotos } from './PhotoField';
import { Field, OwnerSelect, Problem } from './fields';
import { keepFields } from '../form-hooks';

type Kind = 'fx_cash' | 'gold' | 'silver';
const KINDS: { key: Kind; word: string }[] = [
  { key: 'fx_cash', word: 'Pot in another currency' }, { key: 'gold', word: 'Gold' }, { key: 'silver', word: 'Silver' },
];
const PURITY: Record<'gold' | 'silver', { key: string; word: string }[]> = {
  gold: [{ key: '24k', word: '24k' }, { key: '22k', word: '22k' }, { key: '18k', word: '18k' }, { key: '14k', word: '14k' }],
  silver: [{ key: '999', word: 'Fine (999)' }, { key: 'sterling', word: 'Sterling (925)' }],
};
const pick = `${chip} ${chipOff} flex-auto data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground`;

/* The + on Wealth: a pot of foreign cash, or gold, or silver, with what there is of it today and, if wanted,
   a photo of it. The first figure is saved with the holding, so a new holding is never empty. */
export default function AddHolding({ base, members }: { base: string; members: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('fx_cash');
  const [purity, setPurity] = useState('22k');
  const [files, setFiles] = useState<File[]>([]);
  const router = useRouter();
  const metal = kind === 'fx_cash' ? null : kind;

  const [state, act, pending] = useActionState(async (_: Result | null, fd: FormData) => {
    const r = await createHolding(null, withPhotos(fd, files));
    if (r.ok) { haptic('success'); setOpen(false); setFiles([]); router.refresh(); } else haptic('warn');
    return r;
  }, null);

  return (
    <>
      <button type="button" aria-label="Add a pot, gold or silver" aria-haspopup="dialog"
        onClick={() => { haptic('tap'); setOpen(true); }}
        className="press grid size-11 flex-none place-items-center rounded-full bg-card text-foreground in-data-[platform=android]:size-12">
        <Icon name="add" size={24} />
      </button>
      <BottomDrawer open={open} onClose={() => setOpen(false)} label="Add to Wealth" showTitle>
        {/* JS-only on purpose: the drawer cannot open without script, so wrapping the action in a client closure loses no no-JS path. */}
        <form noValidate onSubmit={keepFields(act)} className="flex flex-col gap-4 pt-4">
          <ToggleGroup type="single" spacing={2} value={kind} aria-label="What is it"
            onValueChange={(v) => { if (v) { setKind(v as Kind); setPurity(v === 'silver' ? 'sterling' : '22k'); } }}
            className={`${chipRow} w-full`}>
            {KINDS.map((k) => <ToggleGroupItem key={k.key} value={k.key} className={pick}>{k.word}</ToggleGroupItem>)}
          </ToggleGroup>
          <input type="hidden" name="kind" value={metal ? 'metal' : 'fx_cash'} />
          {metal && <input type="hidden" name="metal" value={metal} />}

          <Field label="Name" name="name" required minLength={2} maxLength={60}
            placeholder={metal === 'gold' ? 'Jewellery' : metal === 'silver' ? 'Silver coins' : 'US savings'} />

          {metal ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-subhead font-medium text-muted-foreground">Purity</span>
                <input type="hidden" name="purity" value={purity} />
                <ToggleGroup type="single" spacing={2} value={purity} aria-label="Purity"
                  onValueChange={(v) => v && setPurity(v)} className={`${chipRow} w-full`}>
                  {PURITY[metal].map((p) => <ToggleGroupItem key={p.key} value={p.key} className={pick}>{p.word}</ToggleGroupItem>)}
                </ToggleGroup>
              </div>
              <Field label="Weight in grams" name="quantity" inputMode="decimal" required placeholder="50"
                hint="Up to three decimals: 12.345 g." />
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-subhead font-medium text-muted-foreground">Currency</span>
                {/* Native on purpose, like the household's own currency field: fifty-odd options are a wheel on a phone. */}
                <select name="currency" required defaultValue={base === 'USD' ? 'EUR' : 'USD'}
                  className="h-12 rounded-xl border border-input bg-card px-3 text-[length:var(--field)] text-foreground">
                  {CURRENCIES.filter((c) => c.code !== base).map((c) => (
                    <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
                  ))}
                </select>
              </label>
              <Field label="Balance today" name="quantity" inputMode="decimal" required placeholder="1500" />
            </>
          )}

          <OwnerSelect members={members} />
          <PhotoField files={files} onChange={setFiles} />
          {state && !state.ok && <Problem>{state.error}</Problem>}
          <Button type="submit" disabled={pending} className="h-12 rounded-xl text-headline font-semibold">
            {pending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </BottomDrawer>
    </>
  );
}
