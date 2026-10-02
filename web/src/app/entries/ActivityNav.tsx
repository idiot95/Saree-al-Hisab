import Segments from '../Segments';

/* Activity is three views of the same books: what happened (entries), what wants a decision (the inbox), and what
   comes round next (schedules). One segmented control at the top of each, so they read as one tab. */
export default function ActivityNav({ current, review = 0 }: { current: 'entries' | 'inbox' | 'schedules'; review?: number }) {
  return (
    <Segments label="Activity" current={current} items={[
      { key: 'entries', href: '/entries', label: 'Entries' },
      { key: 'inbox', href: '/inbox', label: 'To review', count: review },
      { key: 'schedules', href: '/schedules', label: 'Upcoming' },
    ]} />
  );
}
