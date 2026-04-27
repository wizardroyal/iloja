import { Module } from '@nestjs/common';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { InternalInspectionsController } from './internal-inspections.controller';

@Module({
  controllers: [InspectionsController, InternalInspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
