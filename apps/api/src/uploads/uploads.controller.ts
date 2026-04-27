import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common';
import { CurrentUserGuard } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { PresignPutResult } from '../providers/storage/storage.provider';
import { PresignListingPhotoDto, PresignListingPhotoSchema } from './uploads.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(CurrentUserGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('listing-photo')
  @UsePipes(new ZodValidationPipe(PresignListingPhotoSchema))
  presignListingPhoto(@Body() body: PresignListingPhotoDto): Promise<PresignPutResult> {
    return this.uploads.presignListingPhoto(body.listingId, body.contentType);
  }
}
