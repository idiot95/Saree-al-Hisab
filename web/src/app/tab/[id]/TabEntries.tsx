'use client';

import Link from '@/app/NavLink';
import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SwipeRow, { type SwipeAction } from '../../SwipeRow';
import Snack, { type SnackState } from '../../Snack';
import Sheet from '../../Sheet';
import { Button } from '@/components/ui/button';
import { Problem } from '../../worth/fields';
import { Chip, Icon } from '../../Icon';
import { haptic } from '../../haptics';
import { useMoney } from '@/app/currency';
import { addBills, removeEntry, restoreEntry } from '../../entries/actions';
import { shrink } from '../../add/Bills';
import { reminderText, shareReminder } from '../../remind';
import { Face, tabTint } from '../look';
import { startPending } from '../../pending';

export type TabEntry = {
  id: string; on: string; incoming: boolean; title: string;
  icon: string | null; tint: string | null; amount: number; outstanding: number; bills: number;
};
export type TabClaim = {
  id: string; personId: string | null; person: string; tint: string;
  txnId: string; what: string; on: string; outstanding: number;
};
export type TabBill = { id: string; txnId: string; name: string; mime: string };

type Open =
  | { kind: 'bill'; txnId: string; fresh: boolean }
  | { kind: 'remind'; txnId: string | null }
  | null;

const BILLS_PER_ENTRY = 5;
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* What went on a tab, a month at a time, newest first.

   Every row swipes, with the same SwipeRow as Budgets and Entries: Remind
   (a cost somebody still owes on), the bill (Attach, or View once there is
   one), and Delete. `commit` is off, so a long swipe opens the actions and
   never deletes on its own; Delete happens on the tap and can be undone for
   fifteen minutes. The chevron at each row's edge is the same thing as the
   swipe, so none of it is gesture-only. */
export default function TabEntries({
  tabId, tabName, entries, claims, bills, canEdit, today, saved, remindAll,
}: {
  tabId: string; tabName: string; entries: TabEntry[]; claims: TabClaim[]; bills: TabBill[];
  canEdit: boolean; today: string; saved: string | null; remindAll: boolean;
}) {
  const router = useRouter();
  const { format } = useMoney();
  const [, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [snack, setSnack] = useState<SnackState>(null);
  const closeSnack = useCallback(() => setSnack(null), []);

  /* Arriving with ?saved= or ?remind=all opens the matching drawer once; the
     query comes off the address when it closes, so a reload does not ask the
     same question twice. */
  const [open, setOpen] = useState<Open>(() => {
    if (remindAll) return { kind: 'remind', txnId: null };
    const e = saved ? entries.find((x) => x.id === saved) : null;
    return e && !e.incoming && e.bills === 0 ? { kind: 'bill', txnId: e.id, fresh: true } : null;
  });
  const fromUrl = useRef(Boolean(saved || remindAll));
  const close = useCallback(() => {
    setOpen(null);
    if (fromUrl.current) {
      fromUrl.current = false;
      router.replace(`/tab/${tabId}`, { scroll: false });
    }
  }, [router, tabId]);

  const unhide = (id: string) => (s: Set<string>) => { const n = new Set(s); n.delete(id); return n; };

  const remove = (e: TabEntry) => {
    setHidden((s) => new Set(s).add(e.id));
    start(async () => {
      const r = await removeEntry(e.id);
      if (!r.ok) { setHidden(unhide(e.id)); setSnack({ text: r.error, tone: 'error' }); return; }
      setSnack({
        text: `${e.title} deleted${!e.incoming && e.outstanding > 0 ? ` · ${format(e.outstanding)} off the tab` : ''}`,
        undo: () => start(async () => {
          const back = await restoreEntry(e.id);
          if (back.ok) { setHidden(unhide(e.id)); router.refresh(); }
          else setSnack({ text: back.error, tone: 'error' });
        }),
      });
      router.refresh();
    });
  };

  const owedOn = (txnId: string) => claims.filter((c) => c.txnId === txnId && c.outstanding > 0);
  const glyph = (name: string) => <Icon name={name} size={20} />;
  const edit = (id: string) => `/entries/${id}?from=/tab/${tabId}`;
  const actionsFor = (e: TabEntry): SwipeAction[] => [
    { label: 'Edit', icon: glyph('pencil'), tone: 'neutral' as const,
      act: () => { startPending(edit(e.id)); router.push(edit(e.id), { transitionTypes: ['nav-forward'] }); } },
    ...(!e.incoming && owedOn(e.id).length > 0
      ? [{ label: 'Remind', icon: glyph('bell'), tone: 'neutral' as const,
           act: () => setOpen({ kind: 'remind', txnId: e.id }) }]
      : []),
    { label: e.bills > 0 ? 'View bill' : 'Attach bill', icon: glyph('clip'), tone: 'primary' as const,
      act: () => setOpen({ kind: 'bill', txnId: e.id, fresh: false }) },
    { label: 'Delete', icon: glyph('trash'), tone: 'danger' as const, act: () => remove(e) },
  ];

  const visible = entries.filter((e) => !hidden.has(e.id));
  const months: { key: string; rows: TabEntry[] }[] = [];
  for (const e of visible) {
    const key = e.on.slice(0, 7);
    if (months.at(-1)?.key !== key) months.push({ key, rows: [] });
    months.at(-1)!.rows.push(e);
  }
  const monthName = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long', ...(key.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
  });

  /* A sheet slides down after it is closed, so it keeps drawing what it last
     showed rather than going blank on the way out. */
  const [shown, setShown] = useState<Open>(open);
  if (open && open !== shown) setShown(open);
  const target = shown ? entries.find((e) => e.id === shown.txnId) ?? null : null;

  return (
    <>
      {visible.length === 0 && (
        <p className="px-[var(--gutter)] text-[15px] text-muted-foreground">Nothing on this tab yet.</p>
      )}

      {months.map((m) => (
        <section key={m.key} aria-label={monthName(m.key)} className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <h2 className="px-0.5 text-[13px] font-semibold text-muted-foreground">{monthName(m.key)}</h2>
          {/* px-[var(--pad)] and overflow-hidden: the swipe row's negative margin is --pad, so its actions stop at
              the rounded edge and the card never scrolls sideways. */}
          <div className="overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
            {m.rows.map((e, i) => (
              <SwipeRow key={e.id} commit={false} actions={canEdit ? actionsFor(e) : []}>
                <Link href={edit(e.id)} transitionTypes={['nav-forward']} draggable={false}
                  className={`flex min-h-16 items-center gap-3 py-2.5 text-foreground ${i === m.rows.length - 1 ? '' : 'border-b border-border'}`}>
                  {e.incoming ? <Chip icon="receivable" tint="green" size={36} /> : <Chip icon={e.icon} tint={e.tint} size={36} />}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{e.title}</span>
                    <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      <span>{new Date(`${e.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      {!e.incoming && <span>· {e.outstanding > 0 ? `${format(e.outstanding)} owed` : 'settled'}</span>}
                      {e.bills > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
                          · <Icon name="clip" size={12} />{e.bills} {e.bills === 1 ? 'bill' : 'bills'}
                        </span>
                      ) : !e.incoming ? <span>· no bill</span> : null}
                    </span>
                  </span>
                  <span className={`flex-none text-[15px] font-semibold tabular-nums ${e.incoming ? 'text-money-in' : ''}`}>
                    {e.incoming ? '+' : ''}{format(e.amount)}
                  </span>
                </Link>
              </SwipeRow>
            ))}
          </div>
        </section>
      ))}

      <Sheet open={open?.kind === 'bill' && !!target} onClose={close}
        label={shown?.kind === 'bill' && shown.fresh ? 'Attach the bill' : 'Bills'}>
        {shown?.kind === 'bill' && target && (
          <BillBody entry={target} fresh={shown.fresh} tabName={tabName} editHref={edit(target.id)}
            bills={bills.filter((b) => b.txnId === target.id)}
            onDone={(text) => { close(); setSnack({ text }); router.refresh(); }}
            onSkip={close} />
        )}
      </Sheet>

      <Sheet open={open?.kind === 'remind'} onClose={close} label="Remind">
        {shown?.kind === 'remind' && (
          <RemindBody entry={shown.txnId ? target : null} tabId={tabId} tabName={tabName}
            claims={shown.txnId ? owedOn(shown.txnId) : claims.filter((c) => c.outstanding > 0)}
            bills={bills} />
        )}
      </Sheet>

      <Snack snack={snack} onClose={closeSnack} />
    </>
  );
}

/* The bill, right after a cost is saved or any time from the swipe. Images
   are shrunk on the phone exactly as Add Entry shrinks them, then sent. */
function BillBody({ entry, bills, fresh, tabName, editHref, onDone, onSkip }: {
  entry: TabEntry; bills: TabBill[]; fresh: boolean; tabName: string; editHref: string;
  onDone: (text: string) => void; onSkip: () => void;
}) {
  const { format } = useMoney();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const room = BILLS_PER_ENTRY - bills.length;

  const take = async (input: HTMLInputElement) => {
    const list = input.files;
    if (!list?.length) return;
    setBusy(true); setProblem(null);
    const staged: { name: string; mime: string; data: string }[] = [];
    for (const f of Array.from(list).slice(0, room)) {
      const s = await shrink(f).catch(() => null);
      if (s) staged.push({ name: s.name, mime: s.mime, data: s.data });
    }
    input.value = '';
    if (staged.length === 0) {
      setBusy(false); haptic('warn');
      setProblem('That file could not be attached — images and PDFs under 2 MB.');
      return;
    }
    const r = await addBills(entry.id, staged).catch(() => ({ ok: false as const, error: 'No signal — try again in a moment.' }));
    setBusy(false);
    if (!r.ok) { haptic('warn'); setProblem(r.error); return; }
    haptic('success');
    onDone(r.message ?? 'Bill attached.');
  };

  /* A tile is a label around its file input, so the tap that opens the camera
     or the picker is the browser's own and needs no script to reach it. */
  const tile = (icon: string, label: string, input: React.ReactNode) => (
    <label onClick={() => haptic('select')}
      className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-border bg-background text-center text-[15px] font-semibold text-foreground ${busy ? 'pointer-events-none opacity-60' : ''}`}>
      {input}
      <span className="grid size-[46px] place-items-center rounded-full bg-card text-primary"><Icon name={icon} size={22} /></span>
      {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-4 pt-0.5">
      {fresh ? (
        <>
          <div className="flex items-center gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-accent text-primary"><Icon name="check" size={20} /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">Saved on {tabName}</span>
              <span className="text-[13px] text-muted-foreground">
                {entry.title} · {format(entry.amount)}
                {entry.outstanding > 0 ? ` · ${format(entry.outstanding)} to come back` : ''}
              </span>
            </span>
            <Link href={editHref} transitionTypes={['nav-forward']}
              className="press flex min-h-11 flex-none items-center gap-1.5 rounded-xl bg-muted px-3.5 text-[13px] font-semibold text-foreground">
              <Icon name="pencil" size={15} />
              Edit
            </Link>
          </div>
          <span className="h-px bg-border" />
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">Attach the bill?</h2>
            <p className="text-[13px] text-muted-foreground">It goes out with every reminder for this cost. A photo or a PDF.</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Bills for {entry.title}</h2>
          <p className="text-[13px] text-muted-foreground">
            {bills.length === 0 ? 'None yet. They go out with every reminder for this cost.' : 'They go out with every reminder for this cost.'}
          </p>
        </div>
      )}

      {bills.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {bills.map((b) => (
            <li key={b.id}>
              <a href={`/attachment/${b.id}`} target="_blank" rel="noopener noreferrer"
                className="press flex min-h-12 items-center gap-2.5 rounded-xl bg-background px-3 text-foreground">
                <Icon name="clip" size={17} />
                <span className="min-w-0 flex-1 text-[13px] font-semibold [overflow-wrap:anywhere]">{b.name}</span>
                <span className="text-xs font-semibold text-primary">Open</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {room > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {tile('camera', busy ? 'Attaching…' : 'Take a photo',
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => take(e.currentTarget)} className="hidden" />)}
          {tile('upload', busy ? 'Attaching…' : 'Choose a file',
            <input type="file" accept="image/*,application/pdf" multiple
              onChange={(e) => take(e.currentTarget)} className="hidden" />)}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Five bills is the most an entry keeps.</p>
      )}
      {problem && <Problem>{problem}</Problem>}

      {fresh && (
        <div className="flex flex-col items-center gap-0.5">
          <Button type="button" variant="ghost" onClick={onSkip}
            className="h-12 px-5 text-base font-semibold text-muted-foreground">Not now</Button>
          <span className="text-xs text-muted-foreground">Swipe the entry left to add it later.</span>
        </div>
      )}
    </div>
  );
}

/* Remind: one message per person, each through the share sheet — a share has
   to come from a tap, so a person is a button, not a checkbox. For one cost,
   each person's share of it and its bills; for the whole tab, what each owes
   across it. The tab's own claim has nobody to address, so its message names
   nobody and goes to whoever is picked in the share sheet. */
function RemindBody({ entry, tabId, tabName, claims, bills }: {
  entry: TabEntry | null; tabId: string; tabName: string; claims: TabClaim[]; bills: TabBill[];
}) {
  const { format } = useMoney();
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [said, setSaid] = useState<string | null>(null);
  const [withBills, setWithBills] = useState(true);

  type Row = { key: string; name: string | null; tint: string; amount: number; text: string; bills: TabBill[] };
  let rows: Row[];
  if (entry) {
    const own = bills.filter((b) => b.txnId === entry.id);
    rows = claims.map((c) => ({
      key: c.id, name: c.personId ? c.person : null, tint: c.tint, amount: c.outstanding, bills: own,
      text: reminderText({
        person: c.personId ? first(c.person) : null, amount: format(c.outstanding),
        what: entry.title, on: entry.on, tab: tabName,
      }),
    }));
  } else {
    const by = new Map<string, Row & { txns: Set<string> }>();
    for (const c of claims) {
      const key = c.personId ?? 'tab';
      const r = by.get(key) ?? {
        key, name: c.personId ? c.person : null, tint: c.tint, amount: 0, text: '', bills: [], txns: new Set<string>(),
      };
      r.amount += c.outstanding;
      r.txns.add(c.txnId);
      by.set(key, r);
    }
    rows = [...by.values()].map((r) => ({
      ...r,
      bills: bills.filter((b) => r.txns.has(b.txnId)).slice(0, 4),
      text: reminderText({ person: r.name ? first(r.name) : null, amount: format(r.amount), what: tabName }),
    }));
  }
  const anyBills = rows.some((r) => r.bills.length > 0);

  const send = async (r: Row) => {
    haptic('select');
    setSaid(null);
    const note = await shareReminder(r.text, withBills ? r.bills : []);
    setSent((s) => new Set(s).add(r.key));
    if (note) setSaid(note);
  };

  return (
    <div className="flex flex-col gap-4 pt-0.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">{entry ? `Remind about ${entry.title}` : `Remind about ${tabName}`}</h2>
        <p className="text-[13px] text-muted-foreground">
          {entry
            ? `${new Date(`${entry.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${format(entry.outstanding)} still owed`
            : `${format(rows.reduce((n, r) => n + r.amount, 0))} still owed on this tab`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">Nothing is owed on this.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const done = sent.has(r.key);
            return (
              <li key={r.key} className="flex min-h-[62px] items-center gap-3 border-b border-border last:border-b-0">
                {r.name ? <Face name={r.name} tint={r.tint} /> : <Chip icon="folder" tint={tabTint(tabId)} />}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{r.name ?? 'Nobody named'}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(r.amount)}{r.name ? '' : ' · you choose who gets it'}
                  </span>
                </span>
                <Button type="button" variant={done ? 'secondary' : 'default'} onClick={() => send(r)}
                  className={`h-11 rounded-xl px-3.5 font-semibold ${done ? 'text-muted-foreground' : ''}`}>
                  <Icon name={done ? 'check' : 'bell'} size={16} />
                  {done ? 'Sent' : 'Send'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">What they get</span>
          <div className="flex flex-col gap-2.5 rounded-2xl bg-muted px-3.5 py-3">
            <p className="text-[15px] leading-snug">{rows[0].text}</p>
            {anyBills && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-t border-border pt-2 text-[13px]">
                <Icon name="clip" size={16} />
                <span className="flex-1">Send the bills with it</span>
                <input type="checkbox" checked={withBills} onChange={(e) => setWithBills(e.target.checked)}
                  className="size-5 accent-primary" />
              </label>
            )}
          </div>
          <p className="text-xs leading-snug text-muted-foreground">
            One message each, through your phone’s share sheet — WhatsApp, Messages, wherever you already talk.
          </p>
        </div>
      )}
      {said && <p role="status" className="text-[13px] text-muted-foreground">{said}</p>}
    </div>
  );
}
