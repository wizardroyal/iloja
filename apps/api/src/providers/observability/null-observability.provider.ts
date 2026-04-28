import { Injectable, Logger } from '@nestjs/common';
import type { ObservabilityProvider } from './observability.provider';

/**
 * Console-backed stand-in. In production we replace this with a Sentry
 * adapter — but this implementation is correct enough to keep dev quiet
 * and to surface every captured exception to logs.
 */
@Injectable()
export class NullObservabilityProvider implements ObservabilityProvider {
  private readonly logger = new Logger('Observability');

  captureException(err: unknown, context?: Record<string, unknown>): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(
      `${error.message}${context ? ' ' + JSON.stringify(context) : ''}`,
      error.stack,
    );
  }

  captureMessage(
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    context?: Record<string, unknown>,
  ): void {
    const tail = context ? ' ' + JSON.stringify(context) : '';
    if (level === 'error') this.logger.error(message + tail);
    else if (level === 'warn') this.logger.warn(message + tail);
    else this.logger.log(message + tail);
  }

  setUser(_user: { id: string; phone?: string } | null): void {
    // Console sink doesn't track user context — Sentry adapter will.
  }

  async flush(_timeoutMs?: number): Promise<boolean> {
    return true;
  }
}
