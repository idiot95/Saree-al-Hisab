import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/* The type scale's sizes (ql.css) are font sizes, not colours: without this, tailwind-merge would read
   `text-body text-muted-foreground` as two colours and drop one. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'footnote', 'subhead', 'body', 'headline', 'title', 'title-2', 'large-title', 'display', 'amount', 'amount-2'] }],
    },
  },
});

/** Joins class names, letting a later Tailwind class override an earlier one (shadcn/ui's helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
