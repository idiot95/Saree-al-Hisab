import Landed from './Landed';

/* Every screen is wrapped in this. It used to be a React <ViewTransition> that slid screens in and out by
   direction; that animation ran from the moment the router committed — usually before the content had streamed —
   and React held the content back until it ended, which was most of "the app feels slow" (perf-findings.md §4).

   The direction is still told, but on the tap: PendingSkeleton draws the destination's frame moving the way the
   navigation goes (push, pop, sideways between tabs), and this screen takes its place the moment it arrives.
   What is left here is the signal that it has arrived. */
export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Landed />
      {children}
    </>
  );
}
