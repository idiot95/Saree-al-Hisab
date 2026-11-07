'use client';

import { useState } from 'react';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import { shrinkFile } from '../add/Bills';
import { BILL_MAX_FILES } from '@/lib/bills';

/* Photos for a holding: the jewellery on the scale, a jeweller's valuation slip, a bank statement for a pot.

   Each file is shrunk on the phone the moment it is chosen, exactly as a bill on an entry is (shrinkFile in
   add/Bills.tsx): an image is drawn at no more than 1400px and re-encoded as JPEG — which is also what turns
   an iPhone's HEIC into something the server can keep — and a PDF goes as it is. Nothing is uploaded until the
   form is saved. Two ways in: the camera straight away, or the photo library and files (where a PDF lives;
   `capture` on iOS opens only the camera). */
export function PhotoField({ files, onChange }: { files: File[]; onChange: (next: File[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const take = async (list: FileList | null, input: HTMLInputElement) => {
    if (!list?.length) return;
    setBusy(true); setProblem(null);
    const room = BILL_MAX_FILES - files.length;
    const out: File[] = [];
    let refused = 0;
    for (const f of Array.from(list).slice(0, room)) {
      const s = await shrinkFile(f).catch(() => null);
      if (s) out.push(s); else refused++;
    }
    if (list.length > room) setProblem(`Five at most. ${list.length - room} left out.`);
    else if (refused) setProblem(`${refused === 1 ? 'One file' : `${refused} files`} could not be added — images and PDFs under 2 MB.`);
    if (out.length) { haptic('success'); onChange([...files, ...out]); }
    setBusy(false);
    input.value = '';
  };

  const pick = 'press flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card px-3 text-sm font-medium has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50';
  return (
    <div role="group" aria-label="Photos" className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">Photos (optional)</span>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex min-h-11 items-center gap-2.5 rounded-xl bg-muted pl-3">
              <Icon name={f.type === 'application/pdf' ? 'picture_as_pdf' : 'image'} size={18} />
              <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{f.name}</span>
              <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <button type="button" aria-label={`Remove ${f.name}`}
                onClick={() => { haptic('select'); onChange(files.filter((_, n) => n !== i)); }}
                className="grid size-11 flex-none place-items-center rounded-full text-muted-foreground">
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length < BILL_MAX_FILES && (
        /* data-truncate-ok on the visually hidden inputs: Chromium forces text-overflow: ellipsis on a file input (no
           author style can clear it), and its "No file chosen", which nobody sees, would read as cut text. */
        <div className="flex gap-2">
          <label className={pick}>
            <input type="file" name="photo" accept="image/*,application/pdf" multiple capture="environment" className="sr-only" data-truncate-ok="visually hidden file input"
              disabled={busy} onChange={(e) => take(e.target.files, e.target)} />
            <Icon name="photo_camera" size={18} />{busy ? 'Adding…' : 'Take a photo'}
          </label>
          <label className={pick}>
            <input type="file" name="photo" accept="image/*,application/pdf" multiple className="sr-only" data-truncate-ok="visually hidden file input"
              disabled={busy} onChange={(e) => take(e.target.files, e.target)} />
            <Icon name="photo_library" size={18} />Choose files
          </label>
        </div>
      )}
      {problem && <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive"><Icon name="error" size={15} />{problem}</p>}
    </div>
  );
}

/** The form's own fields, with the shrunk photos in place of anything the inputs held. */
export function withPhotos(fd: FormData, files: File[]): FormData {
  fd.delete('photo');
  for (const f of files) fd.append('photo', f, f.name);
  return fd;
}
