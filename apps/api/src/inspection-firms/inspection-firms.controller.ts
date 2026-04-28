import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { InspectionFirm, InspectionFirmBooking } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserGuard,
  CurrentUserParam,
  assertHasRole,
} from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BookFirmDto, BookFirmSchema, CreateFirmDto, CreateFirmSchema } from './inspection-firms.dto';
import { InspectionFirmsService } from './inspection-firms.service';

@Controller('inspection-firms')
export class InspectionFirmsController {
  constructor(private readonly firms: InspectionFirmsService) {}

  @Get()
  list(@Query('zone') zone?: string): Promise<InspectionFirm[]> {
    return this.firms.listActive(zone);
  }

  @Post()
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(CreateFirmSchema))
  create(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: CreateFirmDto,
  ): Promise<InspectionFirm> {
    assertHasRole(user, 'admin');
    return this.firms.create(body);
  }

  @Post(':id/active')
  @UseGuards(CurrentUserGuard)
  toggle(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
    @Body() body: { active: boolean },
  ): Promise<InspectionFirm> {
    assertHasRole(user, 'admin');
    return this.firms.setActive(id, body.active);
  }

  @Post('bookings')
  @UseGuards(CurrentUserGuard)
  @UsePipes(new ZodValidationPipe(BookFirmSchema))
  book(
    @CurrentUserParam() user: CurrentUser,
    @Body() body: BookFirmDto,
  ): Promise<InspectionFirmBooking> {
    assertHasRole(user, 'agent', 'landlord');
    return this.firms.book({ ...body, byUserId: user.id });
  }

  @Get('bookings/mine')
  @UseGuards(CurrentUserGuard)
  myBookings(@CurrentUserParam() user: CurrentUser): Promise<InspectionFirmBooking[]> {
    return this.firms.listMyBookings(user.id);
  }

  @Post('bookings/:id/accept')
  @UseGuards(CurrentUserGuard)
  accept(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<InspectionFirmBooking> {
    assertHasRole(user, 'admin');
    return this.firms.accept(id);
  }

  @Post('bookings/:id/complete')
  @UseGuards(CurrentUserGuard)
  complete(
    @Param('id') id: string,
    @CurrentUserParam() user: CurrentUser,
  ): Promise<InspectionFirmBooking> {
    assertHasRole(user, 'admin');
    return this.firms.complete(id);
  }

  @Post('bookings/:id/cancel')
  @UseGuards(CurrentUserGuard)
  cancel(@Param('id') id: string): Promise<InspectionFirmBooking> {
    return this.firms.cancel(id);
  }
}
