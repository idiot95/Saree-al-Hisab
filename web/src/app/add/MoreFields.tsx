'use client';

import { Icon, tintOf } from '../Icon';
import Link from '@/app/NavLink';
import { Switch } from '@/components/ui/switch';
import { friendlyDay } from '@/lib/recur';
import { useMoney } from '@/app/currency';
import { shares } from '../tab/splits';
import { haptic } from '../haptics';
import Bills, { type Staged } from './Bills';
import { cn } from '@/lib/utils';
import { choice } from '../choice';
import type { Claim, Tab } from './AddEntry';

/* Everything an entry CAN carry beyond amount, category, way and day: where, a remark, the bill, a tab and what it
   means for the budget, what money coming in clears, and whether the household shares it. Collapsed under one row
   so the common entry is three taps, and opened by itself the moment one of these questions starts to matter — a
   tab chosen, or money arriving that matches what somebody owes to the paisa.

   Nothing about the questions changed when they moved here. "Is someone paying this back?" is still asked of
   every expense, and once a tab is chosen the two answers to "was it your spending" still stand side by side
   (counts_as_spend lives on the entry). Exact matches are still a suggestion, never ticked without the tap. */

export type MoreState = {
  merchant: string; note: string; bills: Staged[]; tabId: string | null; coveredKeys: string;
  counts: boolean | null; settleIds: Set<string>; shared: boolean;
};

export default function MoreFields({ kind, state, set, tabs, claims, minor, today, canScan, offline, onUseOwed }: {
  kind: 'expense' | 'income';
  state: MoreState;
  set: <K extends keyof MoreState>(k: K, v: MoreState[K]) => void;
  tabs: Tab[]; claims: Claim[]; minor: number; today: string; canScan: boolean; offline: boolean;
  /** "Use ₹X": set the amount to exactly what the ticked claims are owed. */
  onUseOwed: (minor: number) => void;
}) {
  const { format, keysDisplay, typed, tidy, fromKeys } = useMoney();
  const tab = tabs.find((t) => t.id === state.tabId) ?? null;
  const mine = state.counts ?? tab?.last_counts ?? true;

  const exactIds = new Set(minor > 0 ? claims.filter((c) => c.outstanding === minor).map((c) => c.id) : []);
  const ordered = [...claims].sort((a, b) => Number(exactIds.has(b.id)) - Number(exactIds.has(a.id)));
  const settling = claims.filter((c) => state.settleIds.has(c.id));
  const owedBack = settling.reduce((n, c) => n + c.outstanding, 0);

  const toggleClaim = (id: string) => {
    haptic('select');
    const n = new Set(state.settleIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    set('settleIds', n);
  };

  return (
    <div className="flex flex-col gap-5 pt-1">
      {kind === 'income' && claims.length > 0 && (
        <section aria-labelledby="add-claims" className="flex flex-col gap-2">
          <Eyebrow id="add-claims">Clears what is owed</Eyebrow>
          {exactIds.size > 0 && state.settleIds.size === 0 && (
            <button type="button" data-exact-offer onClick={() => { haptic('success'); set('settleIds', new Set(exactIds)); }}
              className="flex min-h-13 items-center gap-2.5 rounded-xl border border-primary bg-accent px-3 py-2 text-left text-foreground">
              <Icon name="receivable" size={18} />
              <span className="min-w-0 flex-1 text-sm leading-snug">
                {exactIds.size === 1
                  ? <>This is exactly what one open loan is owed. <b>Tick it?</b></>
                  : <>{exactIds.size} open loans are owed exactly this. <b>Tick them?</b></>}
              </span>
            </button>
          )}
          <div role="group" aria-label="Which entries this money clears"
            className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {ordered.map((c) => {
              const isOn = state.settleIds.has(c.id);
              const [bg, ink] = tintOf(c.tint);
              return (
                <button key={c.id} type="button" aria-pressed={isOn} onClick={() => toggleClaim(c.id)}
                  className={cn('flex min-h-14 items-center gap-3 px-3 py-1.5 text-left',
                    isOn ? 'bg-accent text-foreground' : 'text-muted-foreground')}>
                  <span aria-hidden className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-md border text-primary-foreground',
                    isOn ? 'border-primary bg-primary' : 'border-border bg-muted')}>
                    {isOn && <Icon name="check" size={15} />}
                  </span>
                  <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={isOn ? { background: bg, color: ink } : undefined}>
                    {c.person.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-sm font-semibold">{c.person} · {c.what}</span>
                    <span className="text-xs text-muted-foreground">{friendlyDay(c.on, today)}{c.tab ? ` · ${c.tab}` : ''}</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className={cn('text-sm font-[620] tracking-[-0.018em]', isOn ? 'text-money-in' : 'text-muted-foreground')}>{format(c.outstanding)}</span>
                    {exactIds.has(c.id) && (
                      <span className="text-[10px] font-bold tracking-wider whitespace-nowrap text-primary uppercase">Exact match</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {settling.length > 0 && (
            <div className="flex items-center gap-2.5">
              <p className="m-0 flex-1 text-xs leading-normal text-muted-foreground">
                {minor <= owedBack
                  ? `All ${format(minor)} is money back${minor < owedBack ? `, oldest first — ${format(owedBack - minor)} stays owed` : ''}. No category needed.`
                  : `${format(owedBack)} is money back · ${format(minor - owedBack)} is income and needs a category.`}
              </p>
              {minor !== owedBack && (
                <button type="button" onClick={() => { haptic('select'); onUseOwed(owedBack); }}
                  className="min-h-11 shrink-0 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground">
                  Use {format(owedBack)}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Asked on every expense, not only once a tab has been attached: whether a cost was really yours decides
          whether it shows in the budget at all. */}
      <section aria-labelledby="add-tab" className="flex flex-col gap-2">
        <Eyebrow id="add-tab">{kind === 'income' ? 'On a tab' : 'Is someone paying this back?'}</Eyebrow>
        {tabs.length === 0 && (
          <p className="m-0 text-sm leading-normal text-muted-foreground">
            {kind === 'income' ? 'Money that comes in against a trip, a person or the office rides on a tab. '
              : 'Money someone owes you back rides on a tab — a cousin, the office, a trip. '}
            <Link href="/people" transitionTypes={['nav-forward']} className="font-semibold text-primary">
              Open one in Loans</Link>{' '}and it will be offered here.
          </p>
        )}
        {tabs.length > 0 && (
          <div role="group" aria-label="Which tab" className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const isOn = t.id === state.tabId;
              return (
                <button key={t.id} type="button" aria-pressed={isOn}
                  onClick={() => { haptic('select'); set('tabId', isOn ? null : t.id); }}
                  style={choice(isOn)}
                  className="flex min-h-11 max-w-full items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-semibold">
                  <Icon name="tab" size={16} />
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {tab && kind === 'expense' && (
          <>
            {tab.people > 0 && (
              <label className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-muted-foreground">Comes back</span>
                <input
                  value={state.coveredKeys === '' ? '' : keysDisplay(state.coveredKeys)}
                  onChange={(e) => set('coveredKeys', typed(e.target.value))}
                  onBlur={() => set('coveredKeys', tidy(state.coveredKeys))}
                  type="text" inputMode="decimal" autoComplete="off"
                  placeholder={minor > 0 ? `all of it — ${format(minor)}` : 'all of it'}
                  aria-label="How much of this comes back"
                  className="tabular-nums min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-[length:var(--field)] text-foreground" />
              </label>
            )}
            {/* Two answers, both on screen, because a tab carries both kinds: the petrol you burned and are paid
                back for, and the ticket you fronted that was never yours. */}
            <div role="group" aria-label="Was this your spending?" className="flex gap-2">
              {([
                [true, 'receivable', 'Yes, mine', 'Counts in the budget, even if paid back'],
                [false, 'person', 'No, I covered it', 'Owed back, never counted as spending'],
              ] as const).map(([v, icon, label, what]) => {
                const isOn = mine === v;
                return (
                  <button key={String(v)} type="button" aria-pressed={isOn} onClick={() => { haptic('select'); set('counts', v); }}
                    style={choice(isOn)}
                    className="flex min-h-14 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left">
                    <Icon name={icon} size={17} />
                    <span className="flex min-w-0 flex-col gap-px">
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-xs leading-tight opacity-80">{what}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="m-0 text-xs leading-normal text-muted-foreground">
              {tabNote(tab, minor, state.coveredKeys ? fromKeys(state.coveredKeys) : minor, mine, format)}
            </p>
          </>
        )}
      </section>

      <label className="flex flex-col gap-2">
        <Eyebrow>{kind === 'income' ? 'From whom' : 'Where'}</Eyebrow>
        <input value={state.merchant} onChange={(e) => set('merchant', e.target.value.slice(0, 60))}
          autoComplete="off" maxLength={60}
          placeholder={kind === 'income' ? 'Who paid it (optional)' : 'The shop or place (optional)'}
          className="min-h-12 w-full rounded-xl border border-border bg-card px-3.5 text-[length:var(--field)] text-foreground" />
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-2">
          <Eyebrow>Remarks</Eyebrow>
          <textarea value={state.note} onChange={(e) => set('note', e.target.value.slice(0, 200))}
            rows={2} maxLength={200} placeholder="Anything worth remembering about this (optional)"
            className="min-h-16 w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[length:var(--field)] leading-snug text-foreground" />
        </label>
        <Bills staged={state.bills} onChange={(b) => set('bills', b)} />
      </div>

      <label className="flex min-h-11 items-center gap-3 border-t border-border pt-2 in-data-[platform=android]:min-h-12">
        <span className="flex-1 text-sm font-semibold">Shared with the household</span>
        <Switch checked={state.shared} onCheckedChange={(v) => { haptic('select'); set('shared', v); }}
          className="data-[size=default]:h-7 data-[size=default]:w-11 [&_[data-slot=switch-thumb]]:size-6" />
      </label>

      {canScan && !offline && (
        <Link href="/scan" transitionTypes={['nav-forward']}
          className="flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
          <Icon name="photo_camera" size={18} /> Scan or upload a receipt instead
        </Link>
      )}
    </div>
  );
}

function Eyebrow({ id, children }: { id?: string; children: React.ReactNode }) {
  return <span id={id} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{children}</span>;
}

/** What putting this amount on the tab will do, in one line, before Save. */
function tabNote(tab: Tab, minor: number, covered: number, counts: boolean, format: (n: number) => string): string {
  const who = `${tab.people} ${tab.people === 1 ? 'person' : 'people'}`;
  const mine = counts ? 'Counts as your spending' : 'Not your spending';
  /* Nobody on the tab: the tab holds the claim itself (0032), so nobody is named as owing. */
  if (tab.people === 0) return `${mine} · goes on ${tab.name}, and nobody is down as owing for it.`;
  if (minor <= 0) {
    return tab.people === 1 ? `${mine} · they owe all of it back.` : `${mine} · owed back, divided equally among ${who}.`;
  }
  if (covered > minor) return 'That is more than the amount itself.';
  const each = shares(covered, tab.people);
  const top = each.length ? Math.max(...each) : 0;
  const owes = tab.people === 1 ? `they owe ${format(top)}` : `${who} owe ${format(top)} each`;
  const rest = minor - covered;
  return rest > 0 ? `${mine} · ${owes} · ${format(rest)} comes back from nobody` : `${mine} · ${owes}`;
}
