import { SetMetadata } from '@nestjs/common';

export const AUTH_MODE_KEY = 'authMode';
export const ROLES_KEY = 'roles';

/**
 * Auth modes understood by the global JwtAuthGuard:
 *  - required (default): rejects requests without a valid access token
 *  - optional: attaches req.user when a valid token is present, never rejects
 *  - none: skips authentication entirely (marked with @Public)
 */
export type AuthMode = 'required' | 'optional' | 'none';

/** Skips authentication for this route (health checks, gateway callbacks…). */
export const Public = () => SetMetadata(AUTH_MODE_KEY, 'none' as AuthMode);

/** Authenticates when a token is present but allows anonymous callers. */
export const OptionalAuth = () => SetMetadata(AUTH_MODE_KEY, 'optional' as AuthMode);

/** Restricts a route to the listed roles (e.g. @Roles('ADMIN')). */
export const Roles = (...roles: Array<'ADMIN' | 'CUSTOMER'>) => SetMetadata(ROLES_KEY, roles);
