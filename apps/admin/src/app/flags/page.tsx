import type { ListingFlagResponse } from '@iloja/sdk';
import Link from 'next/link';
import { getAdminClient } from '@/lib/api';
import { FlagDecisionButtons } from './decision-buttons';

export const metadata = { title: 'Listing flags · Iloja Ops' };

async function loadFlags(): Promise<ListingFlagResponse[]> {
  try {
    return await getAdminClient().listOpenFlags();
  } catch {
    return [];
  }
}

export default async function FlagsPage() {
  const flags = await loadFlags();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-grove font-semibold mb-2 inline-block">
            ← All surfaces
          </Link>
          <h1 className="font-display text-3xl text-forest">Listing flags</h1>
          <p className="text-ink-muted">Community-submitted concerns awaiting decision.</p>
        </div>
        <span className="bg-warning-tint text-warning-deep rounded-pill px-3 py-1 text-sm font-semibold">
          {flags.length} open
        </span>
      </header>

      {flags.length === 0 ? (
        <p className="text-ink-muted">No open flags.</p>
      ) : (
        <ul className="space-y-3">
          {flags.map((f) => (
            <li
              key={f.id}
              className="bg-white border border-line rounded-2xl p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-1">
                    Flag #{f.id.slice(-6)} · listing {f.listingId.slice(0, 8)}
                  </div>
                  <p className="text-sm text-ink whitespace-pre-wrap mb-2">{f.reason}</p>
                  {f.evidenceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {f.evidenceUrls.map((u, i) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-info-deep underline"
                        >
                          Evidence {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-ink-subtle whitespace-nowrap">
                  {new Date(f.createdAt).toLocaleDateString('en-NG')}
                </span>
              </div>

              <FlagDecisionButtons flagId={f.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
