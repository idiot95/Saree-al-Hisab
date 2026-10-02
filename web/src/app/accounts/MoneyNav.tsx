import Segments from '../Segments';

/* Money is where the household's money sits: in its accounts, with other people, and all of it added up. */
export default function MoneyNav({ current }: { current: 'accounts' | 'people' | 'worth' }) {
  return (
    <Segments label="Money" current={current} items={[
      { key: 'accounts', href: '/accounts', label: 'Accounts' },
      { key: 'people', href: '/people', label: 'Loans' },
      { key: 'worth', href: '/worth', label: 'Net worth' },
    ]} />
  );
}
