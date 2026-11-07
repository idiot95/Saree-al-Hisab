import { Icon } from './Icon';

/* The furniture the in-place forms share (an account, a way to pay, a category, a regular payment, a statement):
   the same label, select, note and add-row as auth-ui's Field, so every form in the app reads as one family.
   No hooks, so a server page and a client form can both use them. */

/** A field's or a fieldset's label: the one auth-ui's Field and the holdings Field draw too. */
export const fieldLabel = 'text-subhead font-medium text-muted-foreground';

/** Buttons inside a form or an opened row: the filled one, the quiet one and the destructive one, 48px like the
 *  rest of the app's forms. Household's rows use them too. */
export const solid = 'press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-headline font-semibold text-primary-foreground transition-colors duration-(--dur-2) disabled:bg-muted disabled:text-muted-foreground';
export const ghost = 'press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-headline font-semibold text-muted-foreground disabled:opacity-60';
export const danger = 'press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 text-headline font-semibold text-destructive disabled:opacity-60';

/* One chip, app-wide (v3.1 P3, ux-audit C1). What is drawn is 32px; what takes the tap is 44 (48 on Android): an
   invisible ::after reaches 6px (8) past the border, so the shape stays small while the target stays honest. A chip
   is never narrower than 48px, so "All" is a short pill, not a dot. A row of chips is `chipRow`: gap-y-3 is
   32 + 12 = 44, so wrapped rows' targets meet but never overlap. Colours change over --dur-2; the press is the
   global .press scale. */
/** The shape and the hit area. Add `chipOff`/`chipOn`, or a `choice()` style, for the colours. */
export const chip = "press relative inline-flex h-8 min-w-12 max-w-full flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-subhead transition-colors duration-(--dur-2) after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-[''] in-data-[platform=android]:after:-inset-y-[9px]";
/** Unchosen: white with a hairline in the field's ink (border-input), which is the darker of the two edges in dark. */
export const chipOff = 'border-input bg-card font-medium text-foreground';
/** Chosen: the primary plum. The same weight as unchosen, so lighting a chip never widens it and rewraps the row. */
export const chipOn = 'border-primary bg-primary font-medium text-primary-foreground';
/** The quiet weight of the same chip (Activity's kind filter): no ground until chosen, then plum soft. */
export const chipQuiet = 'border-transparent bg-transparent px-2 font-medium text-muted-foreground';
export const chipQuietOn = 'border-transparent bg-accent px-2 font-medium text-accent-foreground';
/** Their row: closer set, and pulled out by the chip's padding so the first word sits on the gutter. */
export const chipQuietRow = '-mx-2 flex flex-wrap gap-x-1 gap-y-3 in-data-[platform=android]:gap-y-4';
/** A wrapping row of chips. */
export const chipRow = 'flex flex-wrap gap-x-1.5 gap-y-3 in-data-[platform=android]:gap-y-4';
/** A count inside a chip (To review 3): 18px, its right edge tucked in so the chip's padding reads even. */
export const countBadge = 'grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 -mr-1 text-caption leading-[18px] font-semibold tabular-nums transition-colors duration-(--dur-2)';
/** A status that is read, not tapped (Owner, Current, Possibly the same thing, Retired): 24px, one height for all.
 *  A status still carries an icon or a word, never colour alone. */
export const statusPill = 'inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-footnote font-semibold';
/** The month pill (MonthPill) and its loading frame: a chip's 32px, each arrow 40 wide (44 on Android). */
export const monthPill = 'flex h-8 flex-none items-center rounded-full border border-border bg-card';
export const monthStep = 'grid h-full w-10 place-items-center in-data-[platform=android]:w-11';
/** A header's action pill (New tab): drawn 36px, the same ::after making the target 44 (48). */
export const headerPill = "press relative inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-4 text-body font-semibold after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] in-data-[platform=android]:after:-inset-y-1.5";

/** A list row's hairline, the iOS way (ux-audit O22): from where the text starts (past a 40px chip and its 12px gap)
 *  to the card's right edge. On a relative row; the caller adds the right reach (after:-right-…) to the card's edge. */
export const rowRule = "after:pointer-events-none after:absolute after:bottom-0 after:left-[52px] after:h-px after:bg-border after:content-['']";

/** A native select dressed as the shadcn Input: 48px, the field size, the card ground. */
export const selectCls = 'h-12 w-full appearance-auto rounded-xl border border-input bg-card px-3 text-[length:var(--field)] text-foreground';

/** An in-place form on its own card. */
export const formCard = 'flex flex-col gap-3.5 rounded-[20px] bg-card shadow-card p-[var(--pad)]';

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
      className="press flex min-h-14 w-full items-center gap-3 rounded-[20px] border border-dashed border-input bg-card px-[var(--pad)] py-2 text-left text-body font-semibold text-foreground">
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

