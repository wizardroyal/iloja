import { MobileFrame } from '@/components/mobile-frame';
import { EscrowFlow } from './escrow-flow';

interface PageProps {
  params: { id: string };
}

export const metadata = { title: 'Escrow — Iloja' };

export default function EscrowPage({ params }: PageProps) {
  return (
    <MobileFrame>
      <EscrowFlow escrowId={params.id} />
    </MobileFrame>
  );
}
