import { Icon } from './Icon';
export { solid, ghost, danger } from './household/rows';

/* The furniture the in-place forms share (an account, a way to pay, a category, a regular payment, a statement):
   the same label, select, note and add-row as auth-ui's Field, so every form in the app reads as one family.
   No hooks, so a server page and a client form can both use them. */

/** A field's or a fieldset's label: the one auth-ui's Field draws. */
export const fieldLabel = 'text-sm font-medium text-muted-foreground';

/** A native select dressed as the shadcn Input: 48px, the field size, the card ground. */
export const selectCls = 'h-12 w-full appearance-auto rounded-xl border border-input bg-card px-3 text-[length:var(--field)] text-foreground';

/** An in-place form on its own card. */
export const formCard = 'flex flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]';

/** A quiet line that explains what saving will do: an icon and the words, on plum-soft. */
export function Info({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-accent px-3.5 py-3 text-sm leading-normal text-accent-foreground">
      <Icon name="info" size={18} className="mt-px" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** "Add an account": the dashed row a list ends with, which opens its form in place. */
export function AddRow({ onClick, children, done }: { onClick: () => void; children: React.ReactNode; done?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="press flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-dashed border-input bg-card px-[var(--pad)] py-2 text-left text-[15px] font-semibold text-foreground">
      <span className="grid size-8 flex-none place-items-center rounded-full bg-accent text-accent-foreground"><Icon name="add" size={18} /></span>
      <span className="min-w-0 flex-1">{children}</span>
      {done}
    </button>
  );
}

/** A small refusal under a one-button form (Archive, Undo): the icon and the words. */
export function Refusal({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="flex items-start gap-1.5 text-sm font-medium text-destructive">
      <Icon name="error" size={18} className="mt-px" /><span className="min-w-0">{children}</span>
    </span>
  );
}
