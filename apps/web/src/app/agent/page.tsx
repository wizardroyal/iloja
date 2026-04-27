import { MobileFrame } from '@/components/mobile-frame';
import { AgentDashboard } from './agent-dashboard';

export const metadata = { title: 'Dashboard — Iloja' };

export default function AgentDashboardPage() {
  return (
    <MobileFrame>
      <AgentDashboard />
    </MobileFrame>
  );
}
