import { redirect } from 'next/navigation';
import { activityUrl } from '../entries/activity-url';

/* Upcoming is a chip on Activity now (/entries?f=upcoming); the old address keeps whatever else it carried. */
export default async function Schedules({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(activityUrl(await searchParams, 'upcoming'));
}
