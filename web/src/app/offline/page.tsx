import Screen from '../Screen';
import OfflineScreen from './OfflineScreen';

export const metadata = { title: 'No connection · Saree al-Hisab' };
/* Dynamic, though it reads nothing: every script on a page carries the
   request's CSP nonce, and a prerendered page would ship with none. The
   service worker fetches this once at install and keeps the copy — headers
   included, so the nonce in the cached policy is the nonce in the cached
   markup — and serves it for any navigation the network cannot answer. */
export const dynamic = 'force-dynamic';

export default function Offline() {
  return (
    <Screen>
      <OfflineScreen />
    </Screen>
  );
}
