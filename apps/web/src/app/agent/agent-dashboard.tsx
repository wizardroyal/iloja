'use client';

import { ApiError, type AgentDashboardResponse } from '@iloja/sdk';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/browser-client';
import { readSession } from '@/lib/session';

type Tab = 'leads' | 'calendar' | 'analytics';

export function AgentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AgentDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('leads');

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace('/login?next=/agent');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const dashboard = await getBrowserClient().getAgentDashboard();
        if (!cancelled) setData(dashboard);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login?next=/agent');
          return;
        }
        setError(err instanceof ApiError ? `API ${err.status}` : 'Network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-sm px-6 text-center">
        {error ?? 'Loading…'}
      </div>
    );
  }

  const score = data.profile?.credibilityScore ?? 0;
  const tier = data.profile?.badgeTier ?? 'new_tier';
  const tierLabel = tier === 'new_tier' ? 'New' : tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <>
      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0 bg-cream border-b border-line">
        <span className="font-display text-2xl text-forest tracking-tight">Dashboard</span>
        <Link
          href="/listings/new"
          className="text-xs font-semibold text-grove bg-success-tint border border-mint rounded-pill px-3 py-1.5"
        >
          + List
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Score + badge widget */}
        <section className="px-5 pt-4">
          <div className="bg-gradient-to-br from-forest to-forest-deep rounded-2xl p-4 text-white shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-mint/80">
                Credibility · {tierLabel}
              </span>
              {data.profile?.isFoundingAgent && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-mint/20 text-mint px-2 py-0.5 rounded-pill">
                  Founding
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-display text-5xl">{score.toFixed(1)}</span>
              <span className="text-mint/70 text-sm">/ 5.0</span>
            </div>
            <div className="flex justify-between text-[11px] text-mint/70 mt-3">
              <span>{data.profile?.completedRentals ?? 0} rentals</span>
              <span>{data.totals.activeListings} active listings</span>
            </div>
          </div>
        </section>

        {/* Quick stats strip */}
        <section className="px-5 pt-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              value={data.totals.totalLeads}
              label="Leads"
              tone={data.totals.totalLeads > 0 ? 'success' : 'idle'}
            />
            <Stat
              value={data.totals.inspectionsThisWeek}
              label="This week"
              tone="info"
            />
            <Stat
              value={data.totals.pendingVerifications}
              label="In review"
              tone={data.totals.pendingVerifications > 0 ? 'warning' : 'idle'}
            />
          </div>
        </section>

        {/* Tabs */}
        <nav className="px-5 pt-5 flex gap-1.5 border-b border-line mb-4">
          {(['leads', 'calendar', 'analytics'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-semibold capitalize ${
                tab === t ? 'text-forest border-b-2 border-forest' : 'text-ink-subtle'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === 'leads' && <LeadsTab leads={data.leads} />}
        {tab === 'calendar' && <CalendarTab inspections={data.upcomingInspections} />}
        {tab === 'analytics' && <AnalyticsTab listings={data.listingAnalytics} />}
      </div>

      <BottomNav />
    </>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'success' | 'info' | 'warning' | 'idle';
}) {
  const toneClass = {
    success: 'bg-success-tint text-grove border-mint',
    info: 'bg-info/10 text-info-deep border-info/30',
    warning: 'bg-warning-tint text-warning-deep border-warning/40',
    idle: 'bg-parchment text-ink-muted border-line',
  }[tone];
  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${toneClass}`}>
      <div className="font-display text-xl font-medium">{value}</div>
      <div className="text-[10px] uppercase tracking-wider font-semibold">{label}</div>
    </div>
  );
}

function LeadsTab({ leads }: { leads: AgentDashboardResponse['leads'] }) {
  if (leads.length === 0) {
    return (
      <p className="px-5 text-sm text-ink-subtle">
        No leads yet. Renters who message your listings show up here.
      </p>
    );
  }
  return (
    <ul className="px-5 space-y-2">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link
            href={`/chat/${lead.id}`}
            className="block bg-white border border-line rounded-2xl p-3.5 shadow-card flex items-center gap-3"
          >
            <span className="w-10 h-10 bg-gradient-to-br from-grove to-forest rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              🏠
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink truncate">{lead.listingTitle}</div>
              <div className="text-[11px] text-ink-subtle truncate">
                {lead.listingNeighborhood} · last active{' '}
                {new Date(lead.lastActiveAt).toLocaleDateString('en-NG')}
              </div>
            </div>
            {lead.unread > 0 && (
              <span className="bg-forest text-white text-[10px] font-bold px-2 py-0.5 rounded-pill">
                {lead.unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CalendarTab({
  inspections,
}: {
  inspections: AgentDashboardResponse['upcomingInspections'];
}) {
  if (inspections.length === 0) {
    return <p className="px-5 text-sm text-ink-subtle">No upcoming inspections.</p>;
  }
  return (
    <ul className="px-5 space-y-2">
      {inspections.map((i) => {
        const at = new Date(i.scheduledAt);
        return (
          <li
            key={i.id}
            className="bg-white border border-line rounded-2xl p-3.5 shadow-card flex items-center gap-3"
          >
            <div className="bg-info/10 border border-info/30 rounded-xl px-3 py-2 text-center text-info-deep flex-shrink-0">
              <div className="text-[10px] font-bold uppercase">
                {at.toLocaleDateString('en-NG', { month: 'short' })}
              </div>
              <div className="font-display text-xl">{at.getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink">
                {at.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[11px] text-ink-subtle">
                {i.status === 'proposed' ? 'Awaiting your confirmation' : 'Confirmed'}
              </div>
            </div>
            <Link
              href={`/chat/${i.threadId}`}
              className="text-xs font-semibold text-forest bg-parchment border border-line-soft rounded-pill px-2.5 py-1.5"
            >
              Open
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AnalyticsTab({
  listings,
}: {
  listings: AgentDashboardResponse['listingAnalytics'];
}) {
  if (listings.length === 0) {
    return (
      <p className="px-5 text-sm text-ink-subtle">
        Analytics show up here once you have an active listing.
      </p>
    );
  }
  return (
    <ul className="px-5 space-y-2">
      {listings.map((l) => (
        <li
          key={l.listingId}
          className="bg-white border border-line rounded-2xl p-3.5 shadow-card"
        >
          <div className="flex items-center justify-between mb-2">
            <Link
              href={`/listings/${l.listingId}`}
              className="text-sm font-semibold text-ink truncate flex-1"
            >
              {l.title}
            </Link>
            <span className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">
              {l.status.replace('_', ' ')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric value={l.totalThreads} label="Leads" />
            <Metric value={l.confirmedInspections} label="Inspections" />
            <Metric value={l.completedEscrows} label="Closed" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-lg text-forest">{value}</div>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-subtle">{label}</div>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="bg-white border-t border-line px-0 pt-2.5 pb-5 flex justify-around items-center flex-shrink-0">
      {[
        { label: 'Home', href: '/', active: false },
        { label: 'Dashboard', href: '/agent', active: true },
        { label: 'Inbox', href: '/inbox', active: false },
        { label: 'Profile', href: '/login', active: false },
      ].map((item) => (
        <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 flex-1">
          <span
            className={`text-[9.5px] font-medium ${item.active ? 'text-forest' : 'text-ink-subtle'}`}
          >
            {item.label}
          </span>
          {item.active && <span className="w-1 h-1 rounded-full bg-grove" />}
        </Link>
      ))}
    </nav>
  );
}
