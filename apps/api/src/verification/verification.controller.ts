import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { VerificationJob } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  RejectVerificationDto,
  RejectVerificationSchema,
  SubmitVerificationDto,
  SubmitVerificationSchema,
} from './verification.dto';
import { VerificationService } from './verification.service';

@Controller('verification/jobs')
@UseGuards(CurrentUserGuard)
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  list(
    @CurrentUserParam() user: CurrentUser,
    @Query('status') status?: 'unclaimed' | 'claimed' | 'submitted' | 'approved' | 'rejected',
  ): Promise<VerificationJob[]> {
    assertHasRole(user, 'operator', 'admin');
    return status ? this.verification.listByStatus(status) : this.verification.listUnclaimed();
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<VerificationJob> {
    assertHasRole(user, 'operator', 'admin');
    return this.verification.findById(id);
  }

  @Post(':id/claim')
  @HttpCode(200)
  claim(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<VerificationJob> {
    assertHasRole(user, 'operator');
    return this.verification.claim(id, user.id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(SubmitVerificationSchema))
  submit(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: SubmitVerificationDto,
  ): Promise<VerificationJob> {
    assertHasRole(user, 'operator');
    return this.verification.submit(id, user.id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<VerificationJob> {
    assertHasRole(user, 'admin');
    return this.verification.approve(id, user.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(RejectVerificationSchema))
  reject(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: RejectVerificationDto,
  ): Promise<VerificationJob> {
    assertHasRole(user, 'admin');
    return this.verification.reject(id, body.reason, user.id);
  }
}
