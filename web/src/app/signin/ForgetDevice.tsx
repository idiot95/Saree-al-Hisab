'use client';

import { useEffect } from 'react';
import { forgetDevice } from '../add/queue';

/* Reaching the sign-in screen means the last session is over. Whatever the
   phone was holding for it — picker names, entries waiting for signal — is
   that person's, not the next one's, so it goes before anyone types. */
export default function ForgetDevice() {
  useEffect(() => { forgetDevice(); }, []);
  return null;
}
