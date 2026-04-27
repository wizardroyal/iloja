import { Module } from '@nestjs/common';
import { EscrowModule } from '../escrow/escrow.module';
import { PaystackWebhookController } from './paystack.controller';

@Module({
  imports: [EscrowModule],
  controllers: [PaystackWebhookController],
})
export class WebhooksModule {}
