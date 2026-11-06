'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { CURRENCIES } from '@/lib/money';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import { createHolding, type Result } from './actions';
import { PhotoField, withPhotos } from './PhotoField';
import { Field, OwnerSelect, Problem } from './fields';

type Kind = 'fx_cash' | 'gold' | 'silver';
const KINDS: { key: Kind; word: string }[] = [
  { key: 'fx_cash', word: 'Pot in another currency' }, { key: 'gold', word: 'Gold' }, { key: 'silver', word: 'Silver' },
];
const PURITY: Record<'gold' | 'silver', { key: string; word: string }[]> = {
  gold: [{ key: '24k', word: '24k' }, { key: '22k', word: '22k' }, { key: '18k', word: '18k' }, { key: '14k', word: '14k' }],
  silver: [{ key: '999', word: 'Fine (999)' }, { key: 'sterling', word: 'Sterling (925)' }],
};
const chip = 'press min-h-11 flex-auto rounded-full border border-border bg-card px-4 text-sm font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground';

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
    <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (o) haptic('tap'); }}>
      <DrawerTrigger asChild>
        <button type="button" aria-label="Add a pot, gold or silver"
          className="press grid size-11 flex-none place-items-center rounded-full bg-card text-foreground in-data-[platform=android]:size-12">
          <Icon name="add" size={24} />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[94dvh] bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--gutter)] pb-[calc(16px+env(safe-area-inset-bottom))]">
          <DrawerTitle className="pt-3 text-xl font-bold">Add to Wealth</DrawerTitle>
          <DrawerDescription className="sr-only">A pot in another currency, gold or silver.</DrawerDescription>
          <form action={act} className="flex flex-col gap-4 pt-4">
            <ToggleGroup type="single" value={kind} aria-label="What is it"
              onValueChange={(v) => { if (v) { setKind(v as Kind); setPurity(v === 'silver' ? 'sterling' : '22k'); } }}
              className="flex w-full flex-wrap gap-2">
              {KINDS.map((k) => <ToggleGroupItem key={k.key} value={k.key} className={chip}>{k.word}</ToggleGroupItem>)}
            </ToggleGroup>
            <input type="hidden" name="kind" value={metal ? 'metal' : 'fx_cash'} />
            {metal && <input type="hidden" name="metal" value={metal} />}

            <Field label="Name" name="name" required minLength={2} maxLength={60}
              placeholder={metal === 'gold' ? 'Jewellery' : metal === 'silver' ? 'Silver coins' : 'US savings'} />

            {metal ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">Purity</span>
                  <input type="hidden" name="purity" value={purity} />
                  <ToggleGroup type="single" value={purity} aria-label="Purity"
                    onValueChange={(v) => v && setPurity(v)} className="flex w-full flex-wrap gap-2">
                    {PURITY[metal].map((p) => <ToggleGroupItem key={p.key} value={p.key} className={chip}>{p.word}</ToggleGroupItem>)}
                  </ToggleGroup>
                </div>
                <Field label="Weight in grams" name="quantity" inputMode="decimal" required placeholder="50"
                  hint="Up to three decimals: 12.345 g." />
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">Currency</span>
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
            <Button type="submit" disabled={pending} className="h-12 rounded-xl text-base font-semibold">
              {pending ? 'Adding…' : 'Add'}
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
