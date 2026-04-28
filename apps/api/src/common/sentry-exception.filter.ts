import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  OBSERVABILITY_PROVIDER,
  type ObservabilityProvider,
} from '../providers/observability/observability.provider';

/**
 * Catches anything that escapes a controller, lets HttpException through
 * to Nest's default response, and forwards the rest (5xx-class) to the
 * observability provider so we don't lose unknown failure modes.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(
    @Inject(OBSERVABILITY_PROVIDER) private readonly observability: ObservabilityProvider,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // 4xx is expected — never page anyone. 5xx surfaced via captureException.
      if (status >= 500) {
        this.observability.captureException(exception, {
          path: req.url,
          method: req.method,
          status,
        });
      }
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { message: body } : body);
      return;
    }

    this.observability.captureException(exception, {
      path: req.url,
      method: req.method,
    });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'internal server error',
    });
  }
}
