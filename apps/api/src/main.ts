import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/sentry-exception.filter';
import {
  OBSERVABILITY_PROVIDER,
  type ObservabilityProvider,
} from './providers/observability/observability.provider';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const observability = app.get<ObservabilityProvider>(OBSERVABILITY_PROVIDER);
  app.useGlobalFilters(new SentryExceptionFilter(observability));

  // Flush observability on graceful shutdown so we don't lose the last few
  // events on a redeploy.
  app.enableShutdownHooks();
  process.on('beforeExit', () => {
    void observability.flush(2000);
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Iloja API listening on :${port}`, 'Bootstrap');
}

void bootstrap();
