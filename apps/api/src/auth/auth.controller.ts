import { Body, Controller, HttpCode, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequestOtpDto, RequestOtpSchema, VerifyOtpDto, VerifyOtpSchema } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(RequestOtpSchema))
  request(@Body() body: RequestOtpDto): Promise<{ pinId: string; expiresAt: string }> {
    return this.auth.requestOtp(body.phone);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(VerifyOtpSchema))
  verify(@Body() body: VerifyOtpDto): Promise<{ token: string; userId: string }> {
    return this.auth.verifyOtp(body.phone, body.code, body.fullName);
  }
}
