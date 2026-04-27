import type { DisputeResponse } from '@iloja/sdk';
import Link from 'next/link';
import { getAdminClient } from '@/lib/api';
import { DisputeDecisionButtons } from './decision-buttons';

export const metadata = { title: 'Disputes · Iloja Ops' };

async function loadDisputes(): Promise<DisputeResponse[]> {
  try {
    return await getAdminClient().listOpenDisputes();
  } catch {
    return [];
  }
}

export default async function DisputesPage() {
  const disputes = await loadDisputes();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-grove font-semibold mb-2 inline-block">
            ← All surfaces
          </Link>
          <h1 className="font-display text-3xl text-forest">Disputes</h1>
        </div>
        <span className="bg-warning-tint text-warning-deep rounded-pill px-3 py-1 text-sm font-semibold">
          {disputes.length} open
        </span>
      </header>

      {disputes.length === 0 ? (
        <p className="text-ink-muted">No open disputes.</p>
      ) : (
        <ul className="space-y-3">
          {disputes.map((d) => {
            const e = d.escrow;
            return (
              <li
                key={d.id}
                className="bg-white border border-line rounded-2xl p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle mb-1">
                      Dispute #{d.id.slice(-6)} · {d.status}
                    </div>
                    <p className="text-sm text-ink mb-2 whitespace-pre-wrap">{d.reason}</p>
                    {e && (
                      <div className="text-xs text-ink-muted">
                        Escrow {e.id.slice(-6)} ·{' '}
                        <span className="font-semibold text-ink">
                          ₦{(Number(BigInt(e.amountKobo)) / 100).toLocaleString('en-NG')}
                        </span>{' '}
                        · {e.kind} · payer {e.payerId.slice(0, 8)} ↔ payee{' '}
                        {e.payeeId.slice(0, 8)}
                      </div>
                    )}
                    {d.evidenceUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.evidenceUrls.map((u, i) => (
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
                    {new Date(d.createdAt).toLocaleDateString('en-NG')}
                  </span>
                </div>

                <DisputeDecisionButtons disputeId={d.id} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
