import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { CurrentUser } from './current-user';
import type { SessionPayload } from './auth.service';

/**
 * Real auth: verifies a Bearer JWT and populates req.user. Replaces the
 * header-based CurrentUserGuard for endpoints behind Auth.js sessions.
 *
 * The header guard is still acceptable for non-prod tooling — production
 * APIs should switch every endpoint to this guard.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.header('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }
    const token = auth.slice('Bearer '.length).trim();
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('invalid bearer token');
    }
    const user: CurrentUser = {
      id: payload.sub,
      roles: payload.roles as CurrentUser['roles'],
    };
    req.user = user;
    return true;
  }
}
