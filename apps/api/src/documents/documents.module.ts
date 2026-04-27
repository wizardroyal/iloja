import { Global, Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { InternalAnchorController } from './internal-anchor.controller';

@Global()
@Module({
  controllers: [DocumentsController, InternalAnchorController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
