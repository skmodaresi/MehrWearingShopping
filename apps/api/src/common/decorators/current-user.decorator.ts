import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
  cartId?: string;
}

/** Injects the verified JWT payload (`req.user`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.user as JwtPayload;
  },
);
