'use client';

/**
 * WhatsApp share button. Doc §2.7: "Lagos real estate runs on WhatsApp.
 * Iloja does not fight this — it routes through it." Every listing share
 * has to one-tap into a WhatsApp message with the share URL. We use the
 * Web Share API where available (native sheet on mobile) and fall back to
 * the wa.me deep link otherwise.
 */
export function WhatsAppShare({ listingId, title }: { listingId: string; title: string }) {
  async function share(): Promise<void> {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/listings/${listingId}`
        : `https://iloja.app/listings/${listingId}`;
    const text = `${title} on Iloja — ${shareUrl}`;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch {
        // user cancelled or unsupported — fall through to wa.me
      }
    }
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener');
  }

  return (
    <button
      onClick={share}
      aria-label="Share on WhatsApp"
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-grove bg-success-tint border border-mint rounded-pill px-2.5 py-1"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.52 3.48A11.93 11.93 0 0012.04 0C5.46 0 .12 5.34.12 11.92c0 2.1.55 4.14 1.6 5.95L0 24l6.27-1.65a11.94 11.94 0 005.77 1.47h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.18-3.45-8.42zM12.05 21.7h-.01a9.86 9.86 0 01-5.03-1.38l-.36-.21-3.72.98.99-3.62-.23-.37a9.83 9.83 0 01-1.5-5.18c0-5.44 4.43-9.87 9.87-9.87 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 012.89 6.97c0 5.43-4.42 9.87-9.86 9.87zm5.41-7.39c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.41-1.49-.89-.79-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.18-1.41-.07-.13-.27-.2-.57-.35z" />
      </svg>
      Share
    </button>
  );
}
