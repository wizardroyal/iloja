import { MobileFrame } from '@/components/mobile-frame';
import { Reports } from './reports';

export const metadata = { title: 'Your reports — Iloja' };

export default function ReportsPage() {
  return (
    <MobileFrame>
      <Reports />
    </MobileFrame>
  );
}
