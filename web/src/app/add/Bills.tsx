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

async function shrink(file: File): Promise<Staged | null> {
  const asBase64 = (blob: Blob) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(new Error('unreadable'));
    r.readAsDataURL(blob);
  });

  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) return null;
    return { name: file.name, mime: file.type, data: await asBase64(file), bytes: file.size };
  }
  if (!file.type.startsWith('image/')) return null;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const scale = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob || blob.size > MAX_BYTES) return null;
  const name = file.name.replace(/\.[^.]+$/, '') || 'Bill';
  return { name: `${name}.jpg`, mime: 'image/jpeg', data: await asBase64(blob), bytes: blob.size };
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
              alignItems: 'center', gap: 10, background: 'var(--c-sunk2)',
            }}>
              <Icon name={s.mime === 'application/pdf' ? 'invoice' : 'camera'} size={17} strokeWidth={1.9} />
              <span style={{
                flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{s.name}</span>
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{kb(s.bytes)}</span>
              <button type="button" aria-label={`Remove ${s.name}`}
                onClick={() => { haptic('select'); onChange(staged.filter((_, n) => n !== i)); }}
                style={{
                  width: 34, height: 34, flex: 'none', borderRadius: 999, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--c-meta)',
                }}>×</button>
            </li>
          ))}
        </ul>
      )}

      {staged.length < MAX_FILES && (
        <button type="button" onClick={() => { haptic('select'); input.current?.click(); }} disabled={busy}
          style={{
            minHeight: 48, borderRadius: 13, display: 'flex', alignItems: 'center', gap: 9,
            padding: '0 14px', border: '1px dashed var(--c-dash)', background: 'var(--c-card)',
            color: 'var(--c-ink)', fontSize: 'var(--step--1)', fontWeight: 600,
          }}>
          <Icon name="camera" size={17} strokeWidth={1.9} />
          {busy ? 'Adding…' : staged.length ? 'Add another bill' : 'Attach a bill or photo'}
        </button>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" multiple
        onChange={(e) => take(e.target.files)} style={{ display: 'none' }} />
      {problem && (
        <span role="alert" style={{ fontSize: 'var(--step--2)', color: 'var(--c-danger)' }}>{problem}</span>
      )}
    </div>
  );
}
