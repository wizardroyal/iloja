/**
 * Vendor-agnostic error / metric surface. First implementation will wrap
 * Sentry; the contract stays small enough that we could swap to Highlight
 * or Honeybadger with a config flip.
 *
 * Console + structured-log fallback ships from day one so dev env always
 * has a sink even when no SENTRY_DSN is configured.
 */
export interface ObservabilityProvider {
  captureException(err: unknown, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warn' | 'error', context?: Record<string, unknown>): void;
  setUser(user: { id: string; phone?: string } | null): void;
  /** Flush buffered events. Used by serverless integrations on shutdown. */
  flush(timeoutMs?: number): Promise<boolean>;
}

export const OBSERVABILITY_PROVIDER = Symbol('OBSERVABILITY_PROVIDER');
