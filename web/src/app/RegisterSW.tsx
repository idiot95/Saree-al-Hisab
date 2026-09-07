'use client';

import { useEffect } from 'react';

/* Registered after the page has settled, so it never competes with the first
   render for bandwidth. */
export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const id = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unavailable service worker costs offline handling and nothing
        // else, so it is not worth troubling anyone about.
      });
    }, 1200);
    return () => clearTimeout(id);
  }, []);
  return null;
}
