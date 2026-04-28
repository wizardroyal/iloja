import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { AgentsModule } from './agents/agents.module';
import { AgreementsModule } from './agreements/agreements.module';
import { AuditModule } from './audit/audit.module';
import { CorporateModule } from './corporate/corporate.module';
import { InspectionFirmsModule } from './inspection-firms/inspection-firms.module';
import { MarketDataModule } from './market-data/market-data.module';
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
import { PayoutsModule } from './payouts/payouts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { QueueModule } from './queue/queue.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UploadsModule } from './uploads/uploads.module';
import { VerificationModule } from './verification/verification.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    ProvidersModule,
    AuditModule,
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
    SavedSearchesModule,
    AgreementsModule,
    SubscriptionsModule,
    AffiliatesModule,
    PayoutsModule,
    InspectionFirmsModule,
    CorporateModule,
    MarketDataModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
