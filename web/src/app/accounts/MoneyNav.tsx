import Segments from '../Segments';

/* Money is where the household's money sits: in its accounts, and all of it added up. What is with other people
   has its own tab, Loans. */
export default function MoneyNav({ current }: { current: 'accounts' | 'worth' }) {
  return (
    <Segments label="Money" current={current} items={[
      { key: 'accounts', href: '/accounts', label: 'Accounts' },
      { key: 'worth', href: '/worth', label: 'Net worth' },
    ]} />
  );
}
