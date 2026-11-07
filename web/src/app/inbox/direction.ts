/* Which way a forwarded bank message moved money, as an icon and a word, never colour alone. A plain module, so the
   server's message screen and the client list read the same table (a 'use client' file's exports reach a server
   component as references, not values). */
export const DIRECTION = {
  debit: { icon: 'north_east', word: 'Money out', tone: 'bg-muted text-foreground' },
  credit: { icon: 'south_west', word: 'Money in', tone: 'bg-money-in/15 text-money-in' },
  none: { icon: 'help', word: 'Direction not clear', tone: 'bg-attention-soft text-attention-soft-foreground' },
} as const;
