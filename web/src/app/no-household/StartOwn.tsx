import Link from 'next/link';
import { primaryBtn } from '../auth-ui';

/* Books of your own are set up on /setup, the same screen a fresh account
   sees — one place for the question of what to call them and what they are
   kept in. */
export default function StartOwn() {
  return (
    <Link href="/setup" className={primaryBtn}>
      Start my own household
    </Link>
  );
}
