import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Escrow } from '@prisma/client';
import { CurrentUser, CurrentUserGuard, CurrentUserParam } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CheckInDto,
  CheckInSchema,
  CreateInspectionEscrowDto,
  CreateInspectionEscrowSchema,
  OpenDisputeDto,
  OpenDisputeSchema,
} from './escrow.dto';
import { EscrowService } from './escrow.service';

@Controller('escrow')
@UseGuards(CurrentUserGuard)
export class EscrowController {
  constructor(private readonly escrow: EscrowService) {}

  @Get()
  mine(@CurrentUserParam() user: CurrentUser): Promise<Escrow[]> {
    return this.escrow.findMine(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUserParam() user: CurrentUser): Promise<Escrow> {
    return this.escrow.findById(id, user.id);
  }

  @Post('inspection')
  @UsePipes(new ZodValidationPipe(CreateInspectionEscrowSchema))
  createInspection(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateInspectionEscrowDto,
  ): Promise<{ escrow: Escrow; authorizationUrl: string }> {
    return this.escrow.createForInspection(body.inspectionId, user.id);
  }

  @Post(':id/check-in')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(CheckInSchema))
  checkIn(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CheckInDto,
  ): Promise<{ ok: true }> {
    return this.escrow.checkIn(id, user.id, body);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@Param('id') id: string, @CurrentUserParam() user: CurrentUser): Promise<Escrow> {
    return this.escrow.confirm(id, user.id);
  }

  @Post(':id/dispute')
  @UsePipes(new ZodValidationPipe(OpenDisputeSchema))
  dispute(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: OpenDisputeDto,
  ): Promise<Escrow> {
    return this.escrow.openDispute(id, user.id, body);
  }
}
