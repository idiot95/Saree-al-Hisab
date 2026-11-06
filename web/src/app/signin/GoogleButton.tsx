'use client';

import { useFormStatus } from 'react-dom';
import { primaryBtn } from '../auth-ui';
import { signInWithGoogle } from './actions';

/* A real form posting a Server Action, so it works before the bundle has
   hydrated: the action redirects to Google either way.
   /join hands in its own action (it sets the invite cookie first), its
   label and the token as a hidden field. */
export default function GoogleButton({ action = signInWithGoogle, label = 'Continue with Google', fields }: {
  action?: (fd: FormData) => Promise<void>;
  label?: string;
  fields?: Record<string, string>;
}) {
  return (
    <form action={action}>
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Submit label={label} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ ...primaryBtn, opacity: pending ? 0.65 : 1 }}>
      <GoogleMark />
      {pending ? 'Opening Google…' : label}
    </button>
  );
}

/* Google's "G", drawn in its own four colours on a white disc so it reads on
   the navy button in both themes. */
function GoogleMark() {
  return (
    <span aria-hidden style={{
      width: 26, height: 26, borderRadius: 999, background: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
    }}>
      <svg width={16} height={16} viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}
