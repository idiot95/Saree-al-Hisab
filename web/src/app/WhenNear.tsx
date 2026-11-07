'use client';

import { useEffect, useRef, useState } from 'react';

/* A chart's code is fetched only when its card comes near the screen (Recharts is a large library, and every
   chart in the app sits below the fold). Rendering the lazy component on the first paint would have Next put its
   chunk among the page's first scripts, which is what lazy was for.

   `className` sets the box's HEIGHT, and the box is that height before, during and after the load, so nothing
   under it moves when the chart arrives. Only the plot goes in here: a chart's caption is words, drawn with the
   page, outside this box (the Wealth placeholder once reserved the plot and not its caption, and the page jumped
   by the caption's height when the chart came in). */
export default function WhenNear({ className = 'h-36', children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } },
      { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`${className} w-full`}>{near ? children : null}</div>;
}
