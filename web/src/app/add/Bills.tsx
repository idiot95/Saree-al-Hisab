'use client';

import { useRef, useState } from 'react';
import { Icon } from '../Icon';
import { haptic } from '../haptics';

/* Photographing the bill at the time of the entry.

   Phones take twelve-megapixel photographs of pieces of paper. Sending one
   whole would be four megabytes of mostly nothing, so an image is drawn onto
   a canvas at no more than 1400px on its long edge and re-encoded as JPEG
   before it is ever sent — a bill comes out around a hundred kilobytes and
   stays perfectly readable. PDFs go as they are, because there is nothing to
   downscale and re-encoding one would be lossy in a way nobody asked for.

   The staging is deliberately local: nothing is uploaded until the entry is
   saved, so abandoning the form leaves nothing behind. */

export type Staged = { name: string; mime: string; data: string; bytes: number };

const MAX_FILES = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const EDGE = 1400;

/* An iPhone photo is often HEIC, which no server here could show. It never
   leaves the phone as HEIC: whatever the browser can decode is drawn onto the
   canvas and re-encoded as JPEG. Some pickers report HEIC with an empty type,
   so the extension counts too; and where createImageBitmap cannot decode it,
   an <img> (which Safari can) is tried before giving up. */
const HEIC = /\.(heic|heif)$/i;
const isImage = (f: File) => f.type.startsWith('image/') || (f.type === '' && HEIC.test(f.name));

async function decode(file: File): Promise<{ src: CanvasImageSource; width: number; height: number; done: () => void } | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (bitmap) return { src: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  const url = URL.createObjectURL(file);
  const img = new Image();
  const ok = await new Promise<boolean>((res) => { img.onload = () => res(true); img.onerror = () => res(false); img.src = url; });
  if (!ok || !img.naturalWidth) { URL.revokeObjectURL(url); return null; }
  return { src: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** The file as it should be sent: an image downscaled and re-encoded as JPEG
 *  (HEIC included), a PDF as it is, anything else or anything too large null. */
export async function shrinkFile(file: File): Promise<File | null> {
  if (file.type === 'application/pdf') return file.size > MAX_BYTES ? null : file;
  if (!isImage(file)) return null;

  const pic = await decode(file);
  if (!pic) return null;
  const scale = Math.min(1, EDGE / Math.max(pic.width, pic.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pic.width * scale);
  canvas.height = Math.round(pic.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) { pic.done(); return null; }
  ctx.drawImage(pic.src, 0, 0, canvas.width, canvas.height);
  pic.done();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob || blob.size > MAX_BYTES) return null;
  const name = file.name.replace(/\.[^.]+$/, '') || 'Photo';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
}

export async function shrink(file: File): Promise<Staged | null> {
  const asBase64 = (blob: Blob) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(new Error('unreadable'));
    r.readAsDataURL(blob);
  });
  const out = await shrinkFile(file);
  if (!out) return null;
  // A bill keeps the name it had; an image is renamed .jpg because it now is one.
  const name = out === file ? file.name : out.name.replace(/^Photo\.jpg$/, 'Bill.jpg');
  return { name, mime: out.type, data: await asBase64(out), bytes: out.size };
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

export default function Bills({ staged, onChange }: {
  staged: Staged[]; onChange: (next: Staged[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const take = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setProblem(null);
    const room = MAX_FILES - staged.length;
    const out: Staged[] = [];
    let refused = 0;
    for (const f of Array.from(files).slice(0, room)) {
      const s = await shrink(f).catch(() => null);
      if (s) out.push(s); else refused++;
    }
    if (refused > 0) setProblem(`${refused === 1 ? 'One file' : `${refused} files`} could not be added — images and PDFs under 2 MB.`);
    if (out.length) { haptic('success'); onChange([...staged, ...out]); }
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {staged.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {staged.map((s, i) => (
            <li key={`${s.name}-${i}`} style={{
              minHeight: 46, padding: '6px 6px 6px 12px', borderRadius: 12, display: 'flex',
              alignItems: 'center', gap: 10, background: 'var(--background)',
            }}>
              <Icon name={s.mime === 'application/pdf' ? 'invoice' : 'camera'} size={17} />
              <span style={{
                flex: 1, minWidth: 0, fontSize: 'var(--text-subhead)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{s.name}</span>
              <span style={{ fontSize: 'var(--text-footnote)', color: 'var(--muted-foreground)' }}>{kb(s.bytes)}</span>
              <button type="button" aria-label={`Remove ${s.name}`}
                onClick={() => { haptic('select'); onChange(staged.filter((_, n) => n !== i)); }}
                style={{
                  width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)',
                }}>×</button>
            </li>
          ))}
        </ul>
      )}

      {staged.length < MAX_FILES && (
        <button type="button" onClick={() => { haptic('select'); input.current?.click(); }} disabled={busy}
          style={{
            minHeight: 48, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 9,
            padding: '0 14px', border: '1px dashed var(--input)', background: 'var(--card)',
            color: 'var(--foreground)', fontSize: 'var(--text-subhead)', fontWeight: 600,
          }}>
          <Icon name="camera" size={17} />
          {busy ? 'Adding…' : staged.length ? 'Add another bill' : 'Attach a bill or photo'}
        </button>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" multiple
        onChange={(e) => take(e.target.files)} style={{ display: 'none' }} />
      {problem && (
        <span role="alert" style={{ fontSize: 'var(--text-footnote)', color: 'var(--destructive)' }}>{problem}</span>
      )}
    </div>
  );
}
