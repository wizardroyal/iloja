import { MobileFrame } from '@/components/mobile-frame';
import { BankAccountForm } from './bank-account-form';

export const metadata = { title: 'Payout account — Iloja' };

export default function BankAccountPage() {
  return (
    <MobileFrame>
      <BankAccountForm />
    </MobileFrame>
  );
}
