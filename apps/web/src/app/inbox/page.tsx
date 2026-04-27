import { MobileFrame } from '@/components/mobile-frame';
import { Inbox } from './inbox';

export const metadata = { title: 'Inbox — Iloja' };

export default function InboxPage() {
  return (
    <MobileFrame>
      <Inbox />
    </MobileFrame>
  );
}
