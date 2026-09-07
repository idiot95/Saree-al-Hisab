/* The question a tab has to answer once, and an entry can answer again.

   "Is it owed back" and "was it my spending" are different questions, and
   conflating them is how a household ends up either double-counting petrol it
   burned for work or losing sight of a medical bill it actually paid. A tab
   answers this for the arrangement — an office tab is things you bought and
   used and get paid back for; a family tab is money you front — and Add Entry
   offers the other answer for the receipt that does not fit. */

export const COUNTS = [
  {
    id: 'yes',
    label: 'Yes — I paid for it and used it',
    what: 'Petrol you burn for work, a medical bill an insurer refunds. It counts '
      + 'in your budget and your charts, and they still owe you back for it.',
  },
  {
    id: 'no',
    label: 'No — I paid on their behalf',
    what: 'Rent fronted for family, a purchase that was never yours. The money left '
      + 'your account but was never yours to spend, so nothing counts it.',
  },
] as const;

export default function CountsChoice({ value }: { value: boolean }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <legend style={{
        fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)',
        padding: 0, marginBottom: 8,
      }}>
        Do these count as your spending?
      </legend>
      {COUNTS.map((k) => (
        <label key={k.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, padding: '11px 13px',
          borderRadius: 13, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
          cursor: 'pointer',
        }}>
          <input type="radio" name="countsAsSpending" value={k.id}
            defaultChecked={(k.id === 'yes') === value}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--c-seagrass)', flex: 'none' }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{k.label}</span>
            <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>{k.what}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
