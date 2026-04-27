import { MobileFrame } from '@/components/mobile-frame';
import { ChatRoom } from './chat-room';

interface PageProps {
  params: { id: string };
}

export const metadata = { title: 'Chat — Iloja' };

export default function ChatPage({ params }: PageProps) {
  return (
    <MobileFrame>
      <ChatRoom threadId={params.id} />
    </MobileFrame>
  );
}
