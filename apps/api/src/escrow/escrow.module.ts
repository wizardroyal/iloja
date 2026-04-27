import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { InternalEscrowController } from './internal-escrow.controller';

@Module({
  controllers: [EscrowController, DisputesController, InternalEscrowController],
  providers: [EscrowService, DisputesService],
  exports: [EscrowService, DisputesService],
})
export class EscrowModule {}
