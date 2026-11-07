'use client';

import { useEffect } from 'react';

/* Chores the server needs a signed-in visit for, run once per page load, after the screen has settled so they
   never compete with it (v3.1 P5). Today one: the 30-day purge of forwarded messages' text (POST /api/sms/purge).
   Rendered by the root layout only for someone in a household; the answer is not read — a failure costs nothing
   that the next open, a new message or From SMS will not do. */
export default function Housekeeping() {
  useEffect(() => {
    const id = setTimeout(() => {
      fetch('/api/sms/purge', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {});
    }, 2500);
    return () => clearTimeout(id);
  }, []);
  return null;
}
