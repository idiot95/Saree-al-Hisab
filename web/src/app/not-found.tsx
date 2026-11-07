import Link from '@/app/NavLink';
import { Icon } from './Icon';

export const metadata = { title: 'Not here · Saree al-Hisab' };

/* An address that leads nowhere — a link to an entry since deleted, a tab from another household's books, a typo.
   The same words for all of them: whether something exists in somebody else's books is not this screen's to say. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-background px-[var(--gutter)] pb-10 pt-16 text-foreground">
      <section className="flex flex-col items-center gap-3 rounded-[22px] bg-card px-6 py-8 text-center">
        <Icon name="search" size={36} className="text-primary" />
        <h1 className="text-[30px] font-bold tracking-tight leading-tight">Nothing here</h1>
        <p className="max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
          That page isn’t in your books. It may have been deleted, or the link was mistyped.
        </p>
        <Link href="/" className="press mt-1 flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground in-data-[platform=android]:min-h-12">
          <Icon name="home" size={18} />Back to Home
        </Link>
      </section>
    </main>
  );
}
