import Segments from '../Segments';

/* Plan is two views of the same books: what each heading is allowed (budget) and how the months have gone
   (trends). Trends always reads back from today, so the switch carries no month. */
export default function PlanNav({ current }: { current: 'budget' | 'trends' }) {
  return (
    <Segments label="Plan" current={current} items={[
      { key: 'budget', href: '/budget', label: 'Budget' },
      { key: 'trends', href: '/trends', label: 'Trends' },
    ]} />
  );
}
