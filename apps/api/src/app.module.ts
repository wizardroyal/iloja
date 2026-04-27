import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { HealthController } from './health/health.controller';
import { ListingsModule } from './listings/listings.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { UploadsModule } from './uploads/uploads.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProvidersModule,
    AuthModule,
    AgentsModule,
    BenchmarkModule,
    ListingsModule,
    VerificationModule,
    UploadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
