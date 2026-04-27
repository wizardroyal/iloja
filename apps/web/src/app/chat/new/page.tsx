import { MobileFrame } from '@/components/mobile-frame';
import { OpenThreadRedirect } from './open-thread-redirect';

interface PageProps {
  searchParams: { listing?: string };
}

export const metadata = { title: 'New conversation — Iloja' };

export default function NewChatPage({ searchParams }: PageProps) {
  return (
    <MobileFrame>
      <OpenThreadRedirect listingId={searchParams.listing ?? null} />
    </MobileFrame>
  );
}
