import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`Iloja API listening on :${port}`, 'Bootstrap');
}

void bootstrap();
