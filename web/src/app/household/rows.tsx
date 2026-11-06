import { Icon } from '../Icon';

/* The pieces every Household section is drawn from, so the page reads as one list of lists (the Loans and Wealth
   shape): a section's label over one card, and each row an icon in a soft circle, a title, a line under it and,
   where it opens something, a chevron. No hooks, so server and client parts share them. */

export function Section({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  /* Named by its own heading (aria-labelledby), so a screen reader hears the label once, not twice. No hooks here,
     so the id comes from the label; a page never has two sections with the same name. */
  const id = `section-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h2 id={id} className="px-0.5 text-[13px] font-semibold text-muted-foreground">{label}</h2>
      {children}
      {note && <p className="px-0.5 text-[13px] leading-snug text-muted-foreground">{note}</p>}
    </section>
  );
}

/** One card of rows, hairlines between them. */
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-[18px] bg-card [&>*+*]:border-t [&>*+*]:border-border ${className}`}>{children}</div>;
}

/** A row that is itself the button or link: the whole width is the target. */
export const row = 'press flex min-h-14 w-full items-center gap-3 px-[var(--pad)] py-2.5 text-left text-foreground no-underline disabled:opacity-60';

export function Glyph({ name, tone = 'muted' }: { name: string; tone?: 'muted' | 'accent' | 'danger' | 'attention' }) {
  const ground = {
    muted: 'bg-muted text-muted-foreground',
    accent: 'bg-accent text-accent-foreground',
    danger: 'bg-destructive/10 text-destructive',
    attention: 'bg-attention-soft text-attention-soft-foreground',
  }[tone];
  return (
    <span className={`grid size-[38px] flex-none place-items-center rounded-full ${ground}`}>
      <Icon name={name} size={20} />
    </span>
  );
}

export function Words({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{title}</span>
      {sub && <span className="text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{sub}</span>}
    </span>
  );
}

export const Chevron = () => <Icon name="chevron_right" size={20} className="flex-none text-muted-foreground" />;

/** Buttons inside an opened row: the app's form buttons (form-bits), 48px like the rest of its forms. */
export { solid, ghost, danger } from '../form-bits';

/** A confirmation line after a save: an icon and the words. */
export function Done({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl bg-accent px-3.5 py-3 text-sm font-semibold text-accent-foreground">
      <Icon name="check_circle" size={18} className="mt-px" />{children}
    </p>
  );
}

/** A person: their Google picture when there is one, else their initials on plum-soft. */
export function Avatar({ name, image }: { name: string; image: string | null }) {
  return (
    <span className="grid size-[42px] flex-none place-items-center overflow-hidden rounded-full bg-accent text-sm font-bold text-accent-foreground">
      {image
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <img src={image} alt="" width={42} height={42} className="size-[42px] rounded-full" />
        : (name || '?').slice(0, 2).toUpperCase()}
    </span>
  );
}
