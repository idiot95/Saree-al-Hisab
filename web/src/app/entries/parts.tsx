import Link from '@/app/NavLink';
import { Icon } from '../Icon';

/* The pieces every Activity view is built from, the same ones Wealth uses: a section with a small muted heading
   and a line under it, and an empty state that says what would be here and, where there is one, the way to it. */

export function Section({ title, action, foot, children }: {
  title: string; action?: React.ReactNode; foot?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <div className="mx-[var(--gutter)] flex min-h-6 items-center justify-between gap-3 px-0.5">
        <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
        {action}
      </div>
      <div className="mx-[var(--gutter)]">{children}</div>
      {foot && <p className="mx-[var(--gutter)] px-0.5 text-xs leading-relaxed text-muted-foreground">{foot}</p>}
    </section>
  );
}

export function Empty({ icon, text, tone, action }: {
  icon: string; text: React.ReactNode; tone?: 'ok';
  action?: { href: string; label: string; icon?: string; replace?: boolean };
}) {
  return (
    <div className="mx-[var(--gutter)] flex flex-col items-center gap-3 rounded-[18px] bg-card px-6 py-8 text-center">
      <Icon name={icon} size={32} className={tone === 'ok' ? 'text-money-in' : 'text-primary'} />
      <p className="max-w-[32ch] text-sm leading-relaxed text-muted-foreground">{text}</p>
      {action && (
        <Link href={action.href} replace={action.replace} transitionTypes={['nav-forward']}
          className="press flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground in-data-[platform=android]:min-h-12">
          {action.icon && <Icon name={action.icon} size={18} />}{action.label}
        </Link>
      )}
    </div>
  );
}
