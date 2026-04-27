import Link from 'next/link';

interface Surface {
  title: string;
  desc: string;
  sprint: string;
  href?: string;
}

const surfaces: Surface[] = [
  {
    title: 'Verification queue',
    desc: 'Review operator submissions, approve or reject listings.',
    sprint: 'Sprint 1',
    href: '/verification',
  },
  {
    title: 'Operator portal',
    desc: 'Claim verification jobs, capture geotagged media, submit.',
    sprint: 'Sprint 1',
    href: '/operator',
  },
  {
    title: 'Dispute case management',
    desc: 'Evidence review, adjudication, outcome logging.',
    sprint: 'Sprint 4',
    href: '/disputes',
  },
  {
    title: 'User management',
    desc: 'Warnings, restrictions, bans, appeals.',
    sprint: 'Sprint 6',
  },
  {
    title: 'Listing flag review',
    desc: 'Community-flagged listings awaiting decision.',
    sprint: 'Sprint 6',
    href: '/flags',
  },
];

export default function AdminHome() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="font-display text-4xl text-forest mb-2">Iloja Ops</h1>
        <p className="text-ink-muted">Internal console — staff only.</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {surfaces.map((s) => {
          const inner = (
            <>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display text-xl text-forest">{s.title}</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-grove bg-success-tint px-2 py-1 rounded-pill">
                  {s.sprint}
                </span>
              </div>
              <p className="text-sm text-ink-muted">{s.desc}</p>
            </>
          );
          return (
            <li key={s.title}>
              {s.href ? (
                <Link
                  href={s.href}
                  className="block bg-white border border-line rounded-2xl p-5 shadow-card hover:shadow-card-hover transition"
                >
                  {inner}
                </Link>
              ) : (
                <div className="bg-white border border-line rounded-2xl p-5 shadow-card opacity-60">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
