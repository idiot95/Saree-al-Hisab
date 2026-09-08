'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Icon } from '../Icon';
import { format } from '@/lib/money';
import { nth } from '@/lib/ordinal';
import { haptic } from '../haptics';
import { headerBg } from '../auth-ui';
import SwipeRow, { type SwipeAction } from '../SwipeRow';
import { AccountForm, type Editable } from './EditAccount';
import { bankFor, bankFromName, networkFor } from '@/lib/card-brand';

/* Credit accounts are drawn as the object people recognise, not as a long
   settings panel. The face keeps one fixed card proportion and carries only
   the facts that belong on it: identity, what is owed, limit and bill dates.

   The face itself is the swipe row. Pull it left and Pay/Edit appear directly
   underneath; tap the small chevron for the same actions without a gesture.
   Cards stack vertically so that horizontal movement means one thing only. */

export type CardInfo = {
  edit: Editable;
  /** Minor units, positive when the card owes money. */
  owed: number;
  limit: number | null;
  /** `dueOn` is date-only so it never shifts across browser time zones. */
  cycle: { charged: number; entries: number; dueOn: string } | null;
};

export default function CardDeck({ cards, canWrite }: { cards: CardInfo[]; canWrite: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12, margin: '0 var(--gutter) 6px',
      width: 'calc(100% - (var(--gutter) * 2))',
      maxWidth: 'calc(100vw - (var(--gutter) * 2))', minWidth: 0,
    }}>
      {cards.map((card) => <CardBlock key={card.edit.id} card={card} canWrite={canWrite} />)}
    </div>
  );
}

function CardBlock({ card, canWrite }: { card: CardInfo; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { edit: account, owed, cycle } = card;
  const payable = cycle?.charged || owed;
  const actions: SwipeAction[] = canWrite ? [
    {
      label: 'Edit',
      icon: <Icon name="pencil" size={20} strokeWidth={2} />,
      act: () => { haptic('select'); setEditing(true); },
    },
    ...(payable > 0 ? [{
      label: 'Pay', tone: 'primary' as const,
      icon: <Icon name="move" size={20} strokeWidth={2} />,
      act: () => router.push(`/add?kind=transfer&to=${account.id}&amount=${payable}`, {
        transitionTypes: ['nav-forward'],
      }),
    }] : []),
  ] : [];

  if (editing) {
    return (
      <section className="el card" style={{
        background: 'var(--c-card)', borderRadius: 20, padding: '0 var(--pad)', overflow: 'hidden',
      }}>
        <AccountForm account={account} onDone={() => setEditing(false)} />
      </section>
    );
  }

  return (
    <div className="el2" style={{
      width: '100%', minWidth: 0, borderRadius: 20, overflow: 'hidden', background: 'var(--c-card)',
    }}>
      <SwipeRow actions={actions} commit={false} flush grip={canWrite}
        gripColor="rgba(255,255,255,.86)">
        <CardFace card={card} />
      </SwipeRow>
    </div>
  );
}

function CardFace({ card }: { card: CardInfo }) {
  const { edit: account, owed, limit, cycle } = card;
  const bank = bankFor(account.bank_key) ?? bankFromName(account.name);
  const network = networkFor(account.card_network);
  const used = limit ? Math.min(1, owed / limit) : 0;
  const available = limit === null ? null : limit - owed;
  const due = cycle
    ? new Date(`${cycle.dueOn}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : account.due_day ? nth(account.due_day) : '—';
  const statement = account.statement_day ? nth(account.statement_day) : '—';

  return (
    <section aria-label={`${account.name} credit card`} style={{
      aspectRatio: '1.586 / 1', width: '100%', minWidth: 0, borderRadius: 18,
      padding: '16px 18px 15px', color: '#fff', background: headerBg('pumpkin'),
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(0,0,0,.12)',
    }}>
      <span aria-hidden style={{
        position: 'absolute', width: 210, height: 210, borderRadius: 999,
        right: -82, top: -105, border: '1px solid rgba(255,255,255,.13)',
        boxShadow: '0 0 0 30px rgba(255,255,255,.035), 0 0 0 62px rgba(255,255,255,.025)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24, zIndex: 1 }}>
        <span style={{
          width: bank?.key === 'sbi' ? 82 : 42, height: 30, flex: 'none', borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5,
          background: '#fff', boxShadow: '0 2px 8px rgba(31,23,13,.18)',
        }}>
          {bank?.logo
            ? <Image src={bank.logo} alt="" width={82} height={30} unoptimized
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
            : <Icon name="bank" size={20} strokeWidth={1.8} />}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.76)' }}>
            {bank?.label ?? 'Credit card'}
          </span>
          <span style={{
            fontSize: 'var(--step--1)', lineHeight: 1.2, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{account.name}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, zIndex: 1 }}>
        <span aria-hidden style={{
          width: 38, height: 29, borderRadius: 6,
          background: 'linear-gradient(145deg,#F4D79A,#B88737)', border: '1px solid rgba(65,38,4,.26)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)', position: 'relative',
        }}>
          <span style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 1, background: 'rgba(74,45,5,.32)' }} />
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 18, width: 1, background: 'rgba(74,45,5,.28)' }} />
        </span>
        <span aria-hidden style={{ display: 'flex', transform: 'rotate(90deg)', color: 'rgba(255,255,255,.72)' }}>
          <Icon name="wifi" size={22} strokeWidth={1.7} />
        </span>
      </div>

      <div className="n" style={{
        marginTop: 11, zIndex: 1, fontSize: 'clamp(14px, 4.4vw, 19px)', fontWeight: 650,
        letterSpacing: '.12em', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,.12)',
      }}>
        ••••&nbsp; ••••&nbsp; ••••&nbsp; {account.last4 ?? '••••'}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) .75fr .75fr auto', gap: 10,
        alignItems: 'end', marginTop: 'auto', paddingTop: 10,
        borderTop: '1px solid rgba(255,255,255,.2)', zIndex: 1,
      }}>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.64)' }}>
            {owed > 0 ? 'Outstanding' : 'Nothing owed'}
          </span>
          <span className="t n" style={{ fontSize: 'clamp(17px, 5vw, 23px)', fontWeight: 700, lineHeight: 1.05 }}>
            {format(owed)}
          </span>
        </span>
        <CardFact label="Statement" value={statement} />
        <CardFact label="Due" value={due} />
        <span style={{
          width: 48, height: 32, borderRadius: 7, padding: 5, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(31,23,13,.14)',
        }}>
          {network?.logo
            ? <Image src={network.logo} alt={network.label} width={48} height={32} unoptimized
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span style={{ color: '#4b4b4b', fontSize: 8, fontWeight: 800 }}>CARD</span>}
        </span>
      </div>

      {limit !== null && <span aria-label={available !== null && available >= 0
        ? `${format(available)} available` : `${format(Math.abs(available ?? 0))} over limit`} style={{
        position: 'absolute', left: 0, bottom: 0, width: `${used * 100}%`, height: 3,
        background: 'rgba(255,255,255,.9)', zIndex: 2,
      }} />}
    </section>
  );
}

function CardFact({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,.64)',
      }}>{label}</span>
      <span className="n" style={{ fontSize: 'var(--step--1)', fontWeight: 700 }}>{value}</span>
    </span>
  );
}
