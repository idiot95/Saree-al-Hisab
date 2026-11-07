import { smsDrafts, type SmsDraftRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import SmsDrafts, { type SmsRow } from '../inbox/SmsDrafts';
import { Empty } from './parts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Activity › From SMS: bank messages a phone forwarded, each waiting to become an entry or be dismissed. Not
   month-filtered: a message waits until somebody decides. `dismissed` is the message just dismissed on its own
   screen, whose Undo is offered here. */
export async function loadSms(hh: string, canWrite: boolean, dismissed: unknown) {
  const sms = await withHousehold(hh, () => smsDrafts(hh));
  const justDismissed = canWrite && typeof dismissed === 'string' && UUID.test(dismissed) ? dismissed : null;
  const body = (
    /* Always in the tree, so the Undo on a dismissed message outlives the list it emptied. */
    <SmsDrafts rows={sms.map(toRow)} canWrite={canWrite} justDismissed={justDismissed}
      empty={<Empty icon="sms"
        text="No bank messages waiting. Forward your bank’s messages from your phone and each one waits here until you add it or dismiss it."
        action={canWrite ? { href: '/household/capture', label: 'Set up SMS capture', icon: 'phone_iphone' } : undefined} />} />
  );
  return {
    sub: sms.length === 0 ? 'Bank messages you forward land here' : `${sms.length} bank ${sms.length === 1 ? 'message' : 'messages'} to add`,
    body,
  };
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function toRow(d: SmsDraftRow): SmsRow {
  return {
    id: d.id,
    amount: d.amount === null ? null : Number(d.amount),
    direction: d.direction,
    merchant: d.merchant,
    when: d.on_date ? day(d.on_date)
      : new Date(d.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
    account: d.account,
    last4: d.last4,
    sender: d.sender,
  };
}
