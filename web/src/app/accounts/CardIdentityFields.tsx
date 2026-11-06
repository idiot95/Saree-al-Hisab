'use client';

import { Icon } from '../Icon';
import Image from 'next/image';
import { BANKS, CARD_NETWORKS } from '@/lib/card-brand';
import { fieldLabel } from '../form-bits';

export default function CardIdentityFields({ bank, network }: {
  bank?: string | null;
  network?: string | null;
}) {
  return (
    <>
      <ChoiceSet legend="Issuing bank" name="bank_key" value={bank} choices={BANKS} />
      <ChoiceSet legend="Card network" name="card_network" value={network} choices={CARD_NETWORKS} />
    </>
  );
}

function ChoiceSet({ legend, name, value, choices }: {
  legend: string;
  name: string;
  value?: string | null;
  choices: readonly { key: string; label: string; logo: string | null; short?: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`mb-2 ${fieldLabel}`}>{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {choices.map((choice) => (
          /* The chosen one is plum-soft with a primary edge (the household role choice's look); the focus ring
             follows the hidden radio. */
          <label key={choice.key}
            className="group relative flex min-h-[54px] cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-border bg-background px-2.5 py-2 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:shadow-[inset_0_0_0_1px_var(--primary)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
            <input type="radio" name={name} value={choice.key} required
              defaultChecked={value === choice.key}
              className="pointer-events-none absolute opacity-0" />
            {/* A brand mark is drawn for print on white, so it keeps a white ground in both themes; "Other" has none. */}
            <span className={`flex h-[34px] w-[42px] flex-none items-center justify-center rounded-lg p-[5px] shadow-[inset_0_0_0_1px_var(--border)] ${choice.logo ? 'bg-white' : 'bg-muted text-muted-foreground'}`}>
              {choice.logo
                ? <Image src={choice.logo} alt="" width={42} height={34} unoptimized className="block size-full object-contain" />
                : <Icon name="bank" size={20} />}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold leading-tight [overflow-wrap:anywhere]">
              {choice.short ?? choice.label}
            </span>
            {/* Chosen is said by a check as well as the ground and the edge, never by colour alone. */}
            <span aria-hidden className="hidden size-5 flex-none place-items-center rounded-full bg-primary text-primary-foreground group-has-[:checked]:grid">
              <Icon name="check" size={14} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
