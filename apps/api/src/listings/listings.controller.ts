import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Listing } from '@prisma/client';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  async list(
    @Query('type') type?: 'short_let' | 'long_term' | 'commercial',
    @Query('neighborhood') neighborhood?: string,
  ): Promise<Listing[]> {
    return this.listings.findActive({ type, neighborhood });
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<Listing> {
    return this.listings.findById(id);
  }
}
