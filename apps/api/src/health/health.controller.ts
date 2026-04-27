import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  dependencies: {
    database: 'up' | 'down';
  };
}

/**
 * Liveness + readiness in one. Returns 200 with a status field — load
 * balancers treat `degraded` as routable but flag dashboards, while
 * orchestrators (Render, Fly) scrape this to gate deploys.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch (err) {
      this.logger.warn(`Health check db ping failed: ${(err as Error).message}`);
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'iloja-api',
      timestamp: new Date().toISOString(),
      dependencies: { database },
    };
  }
}
