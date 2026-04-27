import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import type { Document } from '@prisma/client';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * Public lookup so anyone can verify a Verified Record badge by its hash.
   * Returns the document row plus the on-chain anchor status — but never
   * the body (private to the platform per the doc).
   */
  @Get(':hash')
  async getByHash(@Param('hash') hash: string): Promise<Document> {
    const doc = await this.documents.findByHash(hash);
    if (!doc) throw new NotFoundException(`Document with hash ${hash} not found`);
    return doc;
  }

  @Get()
  async list(@Query('contextRef') contextRef: string): Promise<Document[]> {
    return this.documents.findByContextRef(contextRef);
  }
}
