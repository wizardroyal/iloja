import type { ReactNode } from 'react';

export type AgentBadgeTier = 'new' | 'blue' | 'silver' | 'gold' | 'diamond';
export type ListingType = 'short-let' | 'long-term' | 'commercial';

export interface PropertyCardProps {
  title: string;
  price: string;
  pricePeriod: string;
  location: string;
  bedrooms: number;
  agentInitial: string;
  agentScore: number;
  agentTier: AgentBadgeTier;
  listingType: ListingType;
  verified: boolean;
  thumbnail?: ReactNode;
}

const tierBgClass: Record<AgentBadgeTier, string> = {
  new: 'bg-ink-subtle',
  blue: 'bg-info',
  silver: 'bg-line-soft',
  gold: 'bg-warning',
  diamond: 'bg-premium',
};

export function PropertyCard({
  title,
  price,
  pricePeriod,
  location,
  bedrooms,
  agentInitial,
  agentScore,
  agentTier,
  listingType,
  verified,
  thumbnail,
}: PropertyCardProps) {
  return (
    <article className="bg-white rounded-[18px] overflow-hidden shadow-card border border-line w-[220px] flex-shrink-0">
      <div className="h-[130px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-grove to-forest">{thumbnail}</div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-forest/60" />

        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {verified && (
            <span className="bg-success-tint/95 text-grove text-[9.5px] font-bold px-2 py-[3px] rounded-md tracking-wide flex items-center gap-1 backdrop-blur">
              ✓ Verified
            </span>
          )}
          <span className="bg-forest/90 text-mint text-[9px] font-semibold px-2 py-[3px] rounded-md backdrop-blur capitalize">
            {listingType.replace('-', ' ')}
          </span>
        </div>

        <button
          aria-label="Save listing"
          className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 12L2 7.5C1 6.5 1 4.5 2.5 3.5S5.5 3 7 4.5C8.5 3 10.5 2.5 11.5 3.5S13 6.5 12 7.5L7 12z"
              stroke="#1A3C34"
              strokeWidth="1.3"
              fill="none"
            />
          </svg>
        </button>

        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded-full border-[1.5px] border-white/85 flex items-center justify-center text-[8px] font-bold text-white ${tierBgClass[agentTier]}`}
            >
              {agentInitial}
            </span>
            <span className="text-[9px] font-semibold text-white drop-shadow">
              ★ {agentScore.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 pb-3.5">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="font-display text-[17px] font-medium text-forest">{price}</span>
          <span className="text-[10px] text-ink-subtle">{pricePeriod}</span>
        </div>
        <h3 className="text-xs font-medium text-ink mb-1.5 leading-snug line-clamp-2">{title}</h3>
        <div className="flex gap-2 items-center">
          <span className="text-[10.5px] text-ink-subtle flex items-center gap-0.5">
            📍 {location}
          </span>
          <span className="text-[10px] text-ink-muted bg-parchment px-1.5 py-0.5 rounded font-medium">
            {bedrooms} bed
          </span>
        </div>
      </div>
    </article>
  );
}
