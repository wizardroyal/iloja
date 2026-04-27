import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

/**
 * Sprint-1 placeholder. Real auth (Auth.js + phone OTP via Termii) lands in a
 * later pass. For now we accept an x-iloja-user-id header so other Sprint-1
 * work can proceed. The header is rejected entirely when NODE_ENV=production.
 */
export interface CurrentUser {
  id: string;
  roles: UserRole[];
}

declare module 'express' {
  interface Request {
    user?: CurrentUser;
  }
}

@Injectable()
export class CurrentUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('header auth disabled in production');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const userId = req.header('x-iloja-user-id');
    if (!userId) throw new UnauthorizedException('missing x-iloja-user-id');
    const rolesHeader = req.header('x-iloja-user-roles') ?? 'renter';
    req.user = {
      id: userId,
      roles: rolesHeader.split(',').map((r) => r.trim()) as UserRole[],
    };
    return true;
  }
}

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) throw new UnauthorizedException('no current user on request');
    return req.user;
  },
);

export function assertHasRole(user: CurrentUser, ...allowed: UserRole[]): void {
  if (!user.roles.some((r) => allowed.includes(r))) {
    throw new ForbiddenException(`requires role: ${allowed.join(' or ')}`);
  }
}
