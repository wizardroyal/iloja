import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  STORAGE_PROVIDER,
  type PresignPutResult,
  type StorageProvider,
} from '../providers/storage/storage.provider';

const FIVE_MINUTES = 60 * 5;
const TEN_MEGABYTES = 10 * 1024 * 1024;

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  async presignListingPhoto(listingId: string, contentType: string): Promise<PresignPutResult> {
    const ext = contentType.split('/')[1];
    const key = `listings/${listingId}/photos/${randomUUID()}.${ext}`;
    return this.storage.presignPut({
      key,
      contentType,
      maxBytes: TEN_MEGABYTES,
      expiresIn: FIVE_MINUTES,
    });
  }
}
