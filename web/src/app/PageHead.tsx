import BackLink from './BackLink';
import Back from './Back';

/* The Quiet Ledger header every screen shares: paper, the title (Inter bold, as on the tabs), a line under it, and either the tab's
   segmented switch (children) or — on a screen pushed on top of a tab — a back arrow to where it came from
   (BackLink: history when there is any, `back` when the screen was opened directly).
   `back` also arms the edge swipe and the floating Back pill (Back.tsx), so a screen is never left with no way out. */
export default function PageHead({ title, sub, right, back, eyebrow, children }: {
  title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; back?: string; eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      {back && <Back to={back} />}
      <header className="flex flex-col gap-3 px-[var(--gutter)] pb-4 pt-4">
        {back && <BackLink to={back} />}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-footnote text-muted-foreground">{eyebrow}</p>}
            <h1 className="text-large-title font-bold tracking-tight leading-tight [overflow-wrap:anywhere]">{title}</h1>
            {sub && <p className="text-subhead text-muted-foreground">{sub}</p>}
          </div>
          {right}
        </div>
        {children}
      </header>
    </>
  );
}

/** A section's small capital label, the one every Quiet Ledger list sits under. */
export function Label({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-6 items-baseline justify-between px-1">
      <h2 className="text-footnote font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}
