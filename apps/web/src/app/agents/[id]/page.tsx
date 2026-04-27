import type { AgentProfileResponse } from '@iloja/sdk';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MobileFrame } from '@/components/mobile-frame';
import { getServerClient } from '@/lib/api';
import { formatNairaFromKobo } from '@/lib/sample-listings';

interface PageProps {
  params: { id: string };
}

async function loadAgent(id: string): Promise<AgentProfileResponse | null> {
  try {
    return await getServerClient().getAgent(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps) {
  const agent = await loadAgent(params.id);
  if (!agent) return { title: 'Agent not found — Iloja' };
  const tier = agent.profile?.badgeTier ?? 'new';
  const score = agent.profile?.credibilityScore.toFixed(1) ?? '—';
  return {
    title: `${agent.user.fullName} · ${capitalize(tier)} agent · Iloja`,
    description: `${score}★ on Iloja · ${agent.stats.activeListings} active listings · ${agent.profile?.completedRentals ?? 0} completed rentals.`,
  };
}

export default async function AgentProfilePage({ params }: PageProps) {
  const agent = await loadAgent(params.id);
  if (!agent) notFound();

  return (
    <MobileFrame>
      <Header />
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Hero agent={agent} />
        <Stats agent={agent} />
        <Tabs />
        <ListingsTab listings={agent.listings} />
        <Reviews reviews={agent.reviews} />
        <div className="h-7" />
      </div>
    </MobileFrame>
  );
}

function Header() {
  return (
    <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-line">
      <Link href="/" className="text-grove text-sm font-semibold">
        ← Back
      </Link>
      <span className="font-display text-lg text-forest">Agent</span>
      <span className="w-10" />
    </header>
  );
}

const tierStyle: Record<
  NonNullable<AgentProfileResponse['profile']>['badgeTier'],
  { ring: string; chip: string; label: string }
> = {
  new: { ring: 'ring-line-soft', chip: 'bg-parchment text-ink-muted', label: 'New' },
  blue: { ring: 'ring-info', chip: 'bg-info/10 text-info-deep', label: 'Blue' },
  silver: { ring: 'ring-line-soft', chip: 'bg-parchment text-ink-muted', label: 'Silver' },
  gold: { ring: 'ring-warning', chip: 'bg-warning-tint text-warning-deep', label: 'Gold' },
  diamond: { ring: 'ring-premium', chip: 'bg-premium/10 text-premium', label: 'Diamond' },
};

function Hero({ agent }: { agent: AgentProfileResponse }) {
  const initial = agent.user.fullName.slice(0, 1).toUpperCase();
  const tier = agent.profile?.badgeTier ?? 'new';
  const score = agent.profile?.credibilityScore ?? 0;
  const styles = tierStyle[tier];

  return (
    <section className="px-5 pt-6 text-center">
      {/* Credibility ring */}
      <div className="relative w-28 h-28 mx-auto mb-3">
        <CredibilityRing score={score} tier={tier} />
        <div
          className={`absolute inset-2 rounded-full bg-gradient-to-br from-grove to-forest flex items-center justify-center text-3xl font-bold text-white ring-4 ${styles.ring}`}
        >
          {initial}
        </div>
        {agent.profile?.isFoundingAgent && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-forest text-mint text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-pill border-2 border-cream">
            Founding
          </span>
        )}
      </div>

      <h1 className="font-display text-2xl text-forest mb-1">{agent.user.fullName}</h1>
      <div className="flex items-center justify-center gap-2 mb-4">
        <span
          className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-pill ${styles.chip}`}
        >
          {styles.label} agent
        </span>
        <span className="text-[11px] text-ink-subtle">
          Joined {new Date(agent.user.createdAt).getFullYear()}
        </span>
      </div>
    </section>
  );
}

function CredibilityRing({
  score,
  tier,
}: {
  score: number;
  tier: NonNullable<AgentProfileResponse['profile']>['badgeTier'];
}) {
  const pct = Math.max(0, Math.min(1, score / 5));
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const tierColor: Record<typeof tier, string> = {
    new: '#C8C4B8',
    blue: '#4A7FB5',
    silver: '#C8C4B8',
    gold: '#C9921A',
    diamond: '#6B4FBF',
  };
  return (
    <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
      <circle cx="56" cy="56" r={radius} stroke="#EDE9E0" strokeWidth="6" fill="none" />
      <circle
        cx="56"
        cy="56"
        r={radius}
        stroke={tierColor[tier]}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
      />
    </svg>
  );
}

function Stats({ agent }: { agent: AgentProfileResponse }) {
  const stats = [
    {
      val: agent.profile?.credibilityScore.toFixed(1) ?? '—',
      lbl: 'Score',
    },
    { val: String(agent.profile?.completedRentals ?? 0), lbl: 'Rentals' },
    { val: String(agent.stats.activeListings), lbl: 'Active' },
    { val: agent.stats.averageRating ? `${agent.stats.averageRating.toFixed(1)}★` : '—', lbl: 'Rated' },
  ];
  return (
    <div className="px-5 mt-2">
      <div className="grid grid-cols-4 bg-white border border-line rounded-2xl shadow-card divide-x divide-line">
        {stats.map((s) => (
          <div key={s.lbl} className="py-3 text-center">
            <div className="font-display text-base font-medium text-forest">{s.val}</div>
            <div className="text-[10px] text-ink-subtle uppercase tracking-wider">{s.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tabs() {
  return (
    <div className="px-5 pt-5 flex gap-1.5 border-b border-line mb-4">
      {[
        { label: 'Listings', active: true },
        { label: 'Reviews', active: false },
        { label: 'About', active: false },
      ].map((t) => (
        <span
          key={t.label}
          className={`px-3 py-2 text-sm font-semibold ${
            t.active ? 'text-forest border-b-2 border-forest' : 'text-ink-subtle'
          }`}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function ListingsTab({ listings }: { listings: AgentProfileResponse['listings'] }) {
  if (listings.length === 0) {
    return <p className="px-5 text-sm text-ink-subtle">No active listings yet.</p>;
  }
  return (
    <ul className="px-5 space-y-2.5 mb-5">
      {listings.map((l) => (
        <li key={l.id}>
          <Link
            href={`/listings/${l.id}`}
            className="block bg-white rounded-2xl overflow-hidden shadow-card border border-line flex"
          >
            <div className="w-[100px] flex-shrink-0 relative bg-gradient-to-br from-grove to-forest">
              <span className="absolute top-1.5 left-1.5 bg-success-tint/95 text-grove text-[8px] font-bold px-1.5 py-0.5 rounded">
                ✓
              </span>
            </div>
            <div className="flex-1 px-3 py-2.5">
              <div className="font-display text-[15px] font-medium text-forest mb-0.5">
                {formatNairaFromKobo(l.priceKobo)}{' '}
                <span className="text-[10px] font-light text-ink-subtle">/{l.pricePeriod}</span>
              </div>
              <div className="text-xs font-medium text-ink mb-1">{l.title}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-ink-subtle">📍 {l.neighborhood}</span>
                <span className="text-[10px] text-ink-muted bg-parchment px-1.5 py-0.5 rounded font-medium">
                  {l.bedrooms} bed
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Reviews({ reviews }: { reviews: AgentProfileResponse['reviews'] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="px-5 mb-4">
      <div className="text-[10px] font-bold tracking-wider uppercase text-ink-subtle mb-2.5">
        Recent reviews
      </div>
      <ul className="space-y-2">
        {reviews.slice(0, 3).map((r) => (
          <li key={r.id} className="bg-white border border-line rounded-2xl p-3.5 shadow-card">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-display text-base text-forest">{r.rating.toFixed(1)}★</span>
              <span className="text-[11px] text-ink-subtle">
                {new Date(r.createdAt).toLocaleDateString('en-NG')}
              </span>
            </div>
            <p className="text-[13px] text-ink-muted leading-relaxed">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
