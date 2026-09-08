import { payOptions, type Way } from '@/lib/pay';

/* Every way to pay, in a plain <select>: one group per account, the account
   itself first in each and its rails — GPay, net banking — after it. Used by
   the forms that are not the Add screen: editing an entry, a schedule, money
   a person hands back. The value is a pay reference (`a:…` or `m:…`) that
   resolvePayment() on the server turns into the account and rail written. */
export function PaySelect({ ways, name, defaultValue, required, disabled, style, id }: {
  ways: Way[]; name: string; defaultValue?: string; required?: boolean; disabled?: boolean;
  style?: React.CSSProperties; id?: string;
}) {
  const groups = payOptions(ways);
  return (
    <select name={name} id={id} defaultValue={defaultValue} required={required} disabled={disabled}
      style={style}>
      {groups.map((g) => g.options.length === 1
        ? <option key={g.label} value={g.options[0].value}>{g.options[0].label}</option>
        : (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
    </select>
  );
}
