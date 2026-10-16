import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthedRequest, JwtPayload } from '../decorators/current-user.decorator';
import { AUTH_MODE_KEY, AuthMode, ROLES_KEY } from '../decorators/auth.decorators';
import { ApiException } from '../http/api-exception';
import { env } from '../config/env';

/**
 * Global authentication guard.
 *
 * Mode comes from route metadata:
 *   default        → Bearer token required
 *   @Public()      → no token needed
 *   @OptionalAuth()→ token used when present, anonymous otherwise
 *
 * Verified payloads are attached as `req.user` and the raw access token is
 * exposed as `req.accessToken` for downstream services.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode =
      this.reflector.getAllAndOverride<AuthMode | undefined>(AUTH_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'required';

    if (mode === 'none') return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearer(request);

    if (!token) {
      if (mode === 'optional') return true;
      throw ApiException.unauthorized('UNAUTHORIZED', 'Missing access token');
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
      return true;
    } catch {
      if (mode === 'optional') return true;
      throw ApiException.unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
    }
  }
}

/** Role check companion — only active when @Roles() metadata is present. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Array<'ADMIN' | 'CUSTOMER'> | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.user) throw ApiException.unauthorized('UNAUTHORIZED', 'Authentication required');
    if (!roles.includes(request.user.role)) {
      throw ApiException.forbidden('FORBIDDEN', 'This endpoint requires a different role');
    }
    return true;
  }
}

function extractBearer(request: AuthedRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}
