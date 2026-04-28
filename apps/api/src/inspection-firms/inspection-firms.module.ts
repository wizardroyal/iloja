import { Module } from '@nestjs/common';
import { InspectionFirmsController } from './inspection-firms.controller';
import { InspectionFirmsService } from './inspection-firms.service';

@Module({
  controllers: [InspectionFirmsController],
  providers: [InspectionFirmsService],
  exports: [InspectionFirmsService],
})
export class InspectionFirmsModule {}
