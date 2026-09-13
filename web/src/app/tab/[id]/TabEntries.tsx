'use client';

import Link from '@/app/NavLink';
import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SwipeRow, { type SwipeAction } from '../../SwipeRow';
import Snack, { type SnackState } from '../../Snack';
import Sheet from '../../Sheet';
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
  const glyph = (name: string) => <Icon name={name} size={20} strokeWidth={2} />;
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

  const target = open ? entries.find((e) => e.id === open.txnId) ?? null : null;

  return (
    <>
      {visible.length === 0 && (
        <p style={{ margin: '0 20px 18px', fontSize: 'var(--step-0)', color: 'var(--c-meta)' }}>
          Nothing on this tab yet.
        </p>
      )}

      {months.map((m) => (
        <section key={m.key} aria-label={monthName(m.key)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
              {monthName(m.key)}
            </h2>
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          </div>
          <div className="el card" style={{
            margin: '0 var(--gutter) 20px', background: 'var(--c-card)', borderRadius: 18,
            padding: '0 var(--pad)', overflow: 'hidden',
          }}>
            {m.rows.map((e, i) => (
              <SwipeRow key={e.id} commit={false} actions={canEdit ? actionsFor(e) : []}>
                <Link href={edit(e.id)} transitionTypes={['nav-forward']} draggable={false} style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 66,
                  textDecoration: 'none', color: 'var(--c-ink)',
                  borderBottom: i === m.rows.length - 1 ? undefined : '1px solid var(--c-rule)',
                }}>
                  {e.incoming ? <Chip icon="receivable" tint="green" /> : <Chip icon={e.icon} tint={e.tint} />}
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{
                      fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{e.title}</span>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--step--2)',
                      color: 'var(--c-meta)', whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                      <span>{new Date(`${e.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      {!e.incoming && <span>· {e.outstanding > 0 ? `${format(e.outstanding)} owed` : 'settled'}</span>}
                      {e.bills > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--c-teal)', fontWeight: 600 }}>
                          · <Icon name="clip" size={12} strokeWidth={2.2} />{e.bills} {e.bills === 1 ? 'bill' : 'bills'}
                        </span>
                      ) : !e.incoming ? <span style={{ color: 'var(--c-faint)' }}>· no bill</span> : null}
                    </span>
                  </span>
                  <span className="t amt" style={{
                    fontSize: 'var(--step-0)', color: e.incoming ? 'var(--c-in)' : 'var(--c-out)',
                  }}>{e.incoming ? '+' : ''}{format(e.amount)}</span>
                </Link>
              </SwipeRow>
            ))}
          </div>
        </section>
      ))}

      <Sheet open={open?.kind === 'bill' && !!target} onClose={close}
        label={open?.kind === 'bill' && open.fresh ? 'Attach the bill' : 'Bills'}>
        {open?.kind === 'bill' && target && (
          <BillBody entry={target} fresh={open.fresh} tabName={tabName} editHref={edit(target.id)}
            bills={bills.filter((b) => b.txnId === target.id)}
            onDone={(text) => { close(); setSnack({ text }); router.refresh(); }}
            onSkip={close} />
        )}
      </Sheet>

      <Sheet open={open?.kind === 'remind'} onClose={close} label="Remind">
        {open?.kind === 'remind' && (
          <RemindBody entry={open.txnId ? target : null} tabId={tabId} tabName={tabName}
            claims={open.txnId ? owedOn(open.txnId) : claims.filter((c) => c.outstanding > 0)}
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
    <label onClick={() => haptic('select')} style={{
      minHeight: 112, borderRadius: 16, border: '1px solid var(--c-border)', background: 'var(--c-sunk2)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 'var(--step-0)', fontWeight: 600, color: 'var(--c-ink)', textAlign: 'center',
      opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer', pointerEvents: busy ? 'none' : undefined,
    }}>
      {input}
      <span className="el" style={{
        width: 46, height: 46, borderRadius: 999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--c-card)', color: 'var(--c-teal)',
      }}><Icon name={icon} size={22} strokeWidth={1.9} /></span>
      {label}
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 2 }}>
      {fresh ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 40, height: 40, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
            }}><Icon name="check" size={20} strokeWidth={2.4} /></span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step-1)', fontWeight: 600 }}>Saved on {tabName}</span>
              <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                {entry.title} · {format(entry.amount)}
                {entry.outstanding > 0 ? ` · ${format(entry.outstanding)} to come back` : ''}
              </span>
            </span>
            <Link href={editHref} transitionTypes={['nav-forward']} className="cta" style={{
              minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)', textDecoration: 'none', flex: 'none',
            }}>
              <Icon name="pencil" size={15} strokeWidth={2} />
              Edit
            </Link>
          </div>
          <span style={{ height: 1, background: 'var(--c-rule)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>Attach the bill?</h2>
            <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              It goes out with every reminder for this cost. A photo or a PDF.
            </p>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>Bills for {entry.title}</h2>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
            {bills.length === 0 ? 'None yet. They go out with every reminder for this cost.' : 'They go out with every reminder for this cost.'}
          </p>
        </div>
      )}

      {bills.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bills.map((b) => (
            <li key={b.id}>
              <a href={`/attachment/${b.id}`} target="_blank" rel="noopener noreferrer" style={{
                minHeight: 48, padding: '0 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--c-sunk2)', color: 'var(--c-ink)', textDecoration: 'none',
              }}>
                <Icon name="clip" size={17} strokeWidth={1.9} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{b.name}</span>
                <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-teal)' }}>Open</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {room > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {tile('camera', busy ? 'Attaching…' : 'Take a photo',
            <input type="file" accept="image/*" capture="environment"
              onChange={(e) => take(e.currentTarget)} style={{ display: 'none' }} />)}
          {tile('upload', busy ? 'Attaching…' : 'Choose a file',
            <input type="file" accept="image/*,application/pdf" multiple
              onChange={(e) => take(e.currentTarget)} style={{ display: 'none' }} />)}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          Five bills is the most an entry keeps.
        </p>
      )}
      {problem && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-danger)' }}>{problem}</p>
      )}

      {fresh && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button type="button" className="cta" onClick={onSkip} style={{
            minHeight: 46, padding: '0 18px', fontSize: 'var(--step-0)', fontWeight: 600, color: 'var(--c-meta)',
          }}>Not now</button>
          <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
            Swipe the entry left to add it later.
          </span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 2 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>
          {entry ? `Remind about ${entry.title}` : `Remind about ${tabName}`}
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          {entry
            ? `${new Date(`${entry.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${format(entry.outstanding)} still owed`
            : `${format(rows.reduce((n, r) => n + r.amount, 0))} still owed on this tab`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--step-0)', color: 'var(--c-meta)' }}>Nothing is owed on this.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => {
            const done = sent.has(r.key);
            return (
              <li key={r.key} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 62,
                borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--c-rule)',
              }}>
                {r.name ? <Face name={r.name} tint={r.tint} /> : <Chip icon="folder" tint={tabTint(tabId)} />}
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{r.name ?? 'Nobody named'}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                    {format(r.amount)}{r.name ? '' : ' · you choose who gets it'}
                  </span>
                </span>
                <button type="button" className="cta" onClick={() => send(r)} style={{
                  minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
                  background: done ? 'var(--c-sunk)' : 'var(--g-primary)',
                  color: done ? 'var(--c-meta)' : 'var(--c-on-primary)',
                }}>
                  <Icon name={done ? 'check' : 'bell'} size={16} strokeWidth={2.2} />
                  {done ? 'Sent' : 'Send'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>What they get</span>
          <div className="quiet" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 'var(--step-0)', lineHeight: 1.45 }}>{rows[0].text}</p>
            {anyBills && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, paddingTop: 8,
                borderTop: '1px solid var(--c-border)', cursor: 'pointer', fontSize: 'var(--step--1)',
              }}>
                <Icon name="clip" size={16} strokeWidth={2} />
                <span style={{ flex: 1 }}>Send the bills with it</span>
                <input type="checkbox" checked={withBills} onChange={(e) => setWithBills(e.target.checked)}
                  style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--c-teal)' }} />
              </label>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            One message each, through your phone’s share sheet — WhatsApp, Messages, wherever you already talk.
          </p>
        </div>
      )}
      {said && <p role="status" style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>{said}</p>}
    </div>
  );
}
