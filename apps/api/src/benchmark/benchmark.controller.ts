import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { BenchmarkService, type BenchmarkResult } from './benchmark.service';

@Controller('benchmark')
export class BenchmarkController {
  constructor(private readonly benchmark: BenchmarkService) {}

  @Get()
  get(
    @Query('type') type: string,
    @Query('neighborhood') neighborhood: string,
    @Query('bedrooms') bedrooms?: string,
  ): Promise<BenchmarkResult> {
    if (!['short_let', 'long_term', 'commercial'].includes(type)) {
      throw new BadRequestException('type must be short_let, long_term, or commercial');
    }
    if (!neighborhood) throw new BadRequestException('neighborhood required');
    return this.benchmark.benchmark({
      type: type as 'short_let' | 'long_term' | 'commercial',
      neighborhood,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
    });
  }
}
