/* Shared furniture for the screens that stand between someone and the
   books. No hooks here on purpose, so the same pieces work in a server page
   and inside a client form. */

import { CURRENCIES } from '@/lib/money';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { fieldLabel } from './form-bits';

/* The two buttons every one of these screens is built from: the filled one (plum, the one way forward) and the
   quiet one (a card-coloured outline, for the way round). Class strings, so a <Link>, an <a> and a <button> can
   all wear them. */
export const primaryBtn = cn(buttonVariants(),
  'h-auto min-h-[52px] w-full gap-2.5 rounded-xl px-4 text-base font-semibold whitespace-normal');
export const quietBtn = cn(buttonVariants({ variant: 'outline' }),
  'h-auto min-h-[52px] w-full rounded-xl border-border bg-card px-4 text-base font-semibold whitespace-normal text-foreground no-underline shadow-none dark:border-border dark:bg-card');
/** A link-weight action under the buttons (Sign out, "Sign in with your password"): still a 44px target. */
export const quietLink = 'flex min-h-11 items-center justify-center px-2 text-sm font-semibold text-foreground underline underline-offset-[3px]';

/** The app's mark, the serif title and a line of what this is, on a centred card on the ground: the same first
 *  impression the screens behind it make. No tab bar — none of these screens is inside the app yet. */
export function AuthShell({ kicker, title, blurb, children }: {
  kicker?: React.ReactNode; title: React.ReactNode; blurb?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-[var(--gutter)] py-10 text-foreground">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-[22px] bg-card p-5 min-[390px]:p-6">
        <header className="flex flex-col gap-3">
          {/* The app's own icon — the letter ح traced once from Noto Naskh (scripts/make-icons.mjs) — not a font
              fallback's guess at it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-[14px]" />
          {kicker && <p className="text-sm text-muted-foreground">{kicker}</p>}
          <h1 className="font-display text-[34px] leading-[1.08] text-balance [overflow-wrap:anywhere]">{title}</h1>
          {blurb && <p className="text-base leading-normal text-muted-foreground">{blurb}</p>}
        </header>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

/** A line of small print inside an auth card. */
export function Small({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm leading-normal text-muted-foreground', className)}>{children}</p>;
}

/** A thin rule with a word in it ("New here"), between the way in and the way round. */
export function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function Field({ label, name, type = 'text', hint, className, ...rest }: {
  label: string; name: string; type?: string; hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <Input name={name} type={type} {...rest}
        className={cn('h-12 rounded-xl bg-card px-3.5 text-[length:var(--field)] shadow-none md:text-[length:var(--field)] dark:bg-card', className)} />
      {hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Which currency a household keeps its books in. A native select on
 *  purpose: eighteen options is a wheel on a phone, not a list of chips. The
 *  symbol leads so the eye can find "₹" or "$" without reading. */
export function CurrencyField({ defaultValue = 'INR', hint, ...rest }: {
  defaultValue?: string; hint?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>Currency</span>
      <select name="currency" defaultValue={defaultValue} {...rest}
        className="h-12 w-full appearance-auto rounded-xl border border-input bg-card px-3 text-[length:var(--field)] text-foreground">
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.symbol.trim()}  {c.name} · {c.code}</option>
        ))}
      </select>
      {hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold leading-normal text-destructive">
      <Icon name="error" size={18} className="mt-px" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** The one thing every dead end has in common: it tells you what to do next. */
export function DeadEnd({ title, body, cta }: {
  title: string; body: string; cta?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-[var(--gutter)] py-10 text-foreground">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-3.5 rounded-[22px] bg-card px-5 py-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="info" size={30} />
        </span>
        <h1 className="font-display text-[30px] leading-tight text-balance">{title}</h1>
        <p className="max-w-[32ch] text-base leading-normal text-muted-foreground">{body}</p>
        {cta && <a href={cta.href} className={cn(quietBtn, 'mt-2')}>{cta.label}</a>}
      </div>
    </main>
  );
}

/** Enough for the person invited to recognise their own address, not enough
 *  for whoever finds the link to learn someone else's. */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, Math.min(2, local.length))}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}
