import { redirect } from 'next/navigation';
import { activityUrl } from '../entries/activity-url';

/* To review is a chip on Activity now (/entries?f=review). The old address still works, with whatever else it
   carried; a message just dismissed on its own screen (?dismissed=) goes to From SMS, where its Undo is offered. */
export default async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(activityUrl(await searchParams, 'review', (q) => (q.has('dismissed') ? 'sms' : null)));
}
