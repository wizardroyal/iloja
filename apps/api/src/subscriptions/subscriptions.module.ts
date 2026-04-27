import { Global, Module } from '@nestjs/common';
import { SubscriptionRequiredGuard } from './subscription-required.guard';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionRequiredGuard],
  exports: [SubscriptionsService, SubscriptionRequiredGuard],
})
export class SubscriptionsModule {}
