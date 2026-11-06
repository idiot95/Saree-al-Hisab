'use client';

import { useState } from 'react';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';

/* A value to paste into the phone's settings, with a Copy that says whether it worked. Shown whole and selectable,
   because a copy that failed has to be done by hand. */
export default function Copy({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied('yes'); haptic('success'); }
    catch { setCopied('failed'); haptic('warn'); }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-stretch gap-2 rounded-xl border border-border bg-background p-1.5 pl-3">
        <code className={`min-w-0 flex-1 self-center select-all py-1.5 text-sm [overflow-wrap:anywhere] ${mono ? 'font-mono' : ''}`}>{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}
          className="press flex min-h-11 flex-none items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-semibold in-data-[platform=android]:min-h-12">
          <Icon name={copied === 'yes' ? 'check' : copied === 'failed' ? 'error' : 'content_copy'} size={18} />
          {copied === 'yes' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
