import type { ReactNode } from 'react';

/**
 * Outer frame that mirrors the reference design: a 390px-wide device shell on
 * a desktop background. On real mobile the frame collapses into the viewport.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-oat py-8 px-4 flex items-start justify-center">
      <div className="w-[390px] max-w-full bg-forest rounded-[50px] p-3.5 shadow-[0_32px_80px_rgba(26,60,52,0.35)]">
        <div className="bg-cream rounded-[38px] overflow-hidden h-[812px] flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
