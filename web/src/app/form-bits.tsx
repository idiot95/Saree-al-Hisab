import { Icon } from './Icon';

/* The furniture the in-place forms share (an account, a way to pay, a category, a regular payment, a statement):
   the same label, select, note and add-row as auth-ui's Field, so every form in the app reads as one family.
   No hooks, so a server page and a client form can both use them. */

/** A field's or a fieldset's label: the one auth-ui's Field and the holdings Field draw too. */
export const fieldLabel = 'text-subhead font-medium text-muted-foreground';

/** Buttons inside a form or an opened row: the filled one, the quiet one and the destructive one, 48px like the
 *  rest of the app's forms. Household's rows use them too. */
export const solid = 'press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-headline font-semibold text-primary-foreground disabled:opacity-60';
export const ghost = 'press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-headline font-semibold text-muted-foreground disabled:opacity-60';
export const danger = 'press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 text-headline font-semibold text-destructive disabled:opacity-60';

/** A native select dressed as the shadcn Input: 48px, the field size, the card ground. */
export const selectCls = 'h-12 w-full appearance-auto rounded-xl border border-input bg-card px-3 text-[length:var(--field)] text-foreground';

/** An in-place form on its own card. */
export const formCard = 'flex flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]';

/** A quiet line that explains what saving will do: an icon and the words, on plum-soft. */
export function Info({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-accent px-3.5 py-3 text-body leading-normal text-accent-foreground">
      <Icon name="info" size={18} className="mt-px" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** "Add an account": the dashed row a list ends with, which opens its form in place. */
export function AddRow({ onClick, children, done, ref }: {
  onClick: () => void; children: React.ReactNode; done?: React.ReactNode; ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" onClick={onClick}
      className="press flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-dashed border-input bg-card px-[var(--pad)] py-2 text-left text-body font-semibold text-foreground">
      <span className="grid size-8 flex-none place-items-center rounded-full bg-accent text-accent-foreground"><Icon name="add" size={18} /></span>
      <span className="min-w-0 flex-1">{children}</span>
      {done}
    </button>
  );
}

/** What just happened, for a screen reader: a polite live region that is always in the page (one that appears with
 *  its text already in it is often not read), so "Groceries added." is announced when it changes. Sighted people
 *  see the row arrive; this says it. */
export function Said({ children }: { children?: React.ReactNode }) {
  return <p role="status" aria-live="polite" className="sr-only">{children}</p>;
}

