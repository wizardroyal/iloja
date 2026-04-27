import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { ChatModule } from './chat/chat.module';
import { CredibilityModule } from './credibility/credibility.module';
import { DocumentsModule } from './documents/documents.module';
import { EscrowModule } from './escrow/escrow.module';
import { FlagsModule } from './flags/flags.module';
import { HealthController } from './health/health.controller';
import { InspectionsModule } from './inspections/inspections.module';
import { ListingsModule } from './listings/listings.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OffersModule } from './offers/offers.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { QueueModule } from './queue/queue.module';
import { UploadsModule } from './uploads/uploads.module';
import { VerificationModule } from './verification/verification.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    ProvidersModule,
    NotificationsModule,
    CredibilityModule,
    DocumentsModule,
    AuthModule,
    AgentsModule,
    BenchmarkModule,
    ListingsModule,
    VerificationModule,
    UploadsModule,
    ChatModule,
    OffersModule,
    InspectionsModule,
    EscrowModule,
    FlagsModule,
    ModerationModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
