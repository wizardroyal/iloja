import { Injectable, Logger } from '@nestjs/common';
import type { PresignPutInput, PresignPutResult, StorageProvider } from './storage.provider';

/**
 * Sprint-1 stand-in. Returns predictable URLs so the upload flow can be tested
 * end-to-end without R2 credentials. Does not enforce content-type or size.
 * Replace with R2StorageProvider once env config is wired.
 */
@Injectable()
export class NullStorageProvider implements StorageProvider {
  private readonly logger = new Logger(NullStorageProvider.name);

  async presignPut(input: PresignPutInput): Promise<PresignPutResult> {
    this.logger.warn(`NullStorageProvider used — no real upload will occur for ${input.key}`);
    return {
      uploadUrl: `https://stub.iloja.local/upload/${encodeURIComponent(input.key)}`,
      publicUrl: `https://stub.iloja.local/${input.key}`,
      key: input.key,
    };
  }
}
