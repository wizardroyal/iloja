import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common';
import type { Document } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GenerateAgreementDto, GenerateAgreementSchema } from './agreements.dto';
import { AgreementsService } from './agreements.service';

@Controller('agreements')
@UseGuards(CurrentUserGuard)
export class AgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(GenerateAgreementSchema))
  generate(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: GenerateAgreementDto,
  ): Promise<Document> {
    assertHasRole(user, 'agent', 'landlord');
    return this.agreements.generate(body, user.id);
  }
}
