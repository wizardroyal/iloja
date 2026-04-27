import { MobileFrame } from '@/components/mobile-frame';
import { LoginFlow } from './login-flow';

export const metadata = { title: 'Sign in — Iloja' };

export default function LoginPage() {
  return (
    <MobileFrame>
      <LoginFlow />
    </MobileFrame>
  );
}
