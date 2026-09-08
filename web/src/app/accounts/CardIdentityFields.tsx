'use client';

import { Icon } from '../Icon';
import Image from 'next/image';
import { BANKS, CARD_NETWORKS } from '@/lib/card-brand';

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
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ marginBottom: 7, padding: 0, fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
        {legend}
      </legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {choices.map((choice) => (
          <label key={choice.key} style={{
            minHeight: 54, padding: '7px 9px', borderRadius: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-sunk2)',
            border: '1px solid var(--c-border)', position: 'relative', overflow: 'hidden',
          }}>
            <input type="radio" name={name} value={choice.key} required
              defaultChecked={value === choice.key}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            <span className="card-choice-mark" style={{
              width: 42, height: 34, flex: 'none', borderRadius: 8, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5,
              boxShadow: 'inset 0 0 0 1px rgba(16,32,38,.08)',
            }}>
              {choice.logo
                ? <Image src={choice.logo} alt="" width={42} height={34} unoptimized
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
                : <Icon name="bank" size={20} strokeWidth={1.8} />}
            </span>
            <span style={{ minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 650, lineHeight: 1.2 }}>
              {choice.short ?? choice.label}
            </span>
          </label>
        ))}
      </div>
      <style>{`
        label:has(> input[name="${name}"]:checked) {
          border-color: var(--c-seagrass) !important;
          background: var(--c-teal-l) !important;
          box-shadow: inset 0 0 0 1px var(--c-seagrass);
        }
        label:has(> input[name="${name}"]:focus-visible) {
          outline: 2px solid var(--c-seagrass);
          outline-offset: 2px;
        }
      `}</style>
    </fieldset>
  );
}
