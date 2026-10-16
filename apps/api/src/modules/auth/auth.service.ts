import { Injectable, Logger } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Role, User } from '../../generated/prisma/client';
import { env } from '../../common/config/env';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  locale: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
  locale: user.locale,
  createdAt: user.createdAt.toISOString(),
});

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Stateless access tokens (JWT, 15 min) + rotating, DB-backed refresh tokens
 * (hashed at rest). Rotation means a stolen refresh token is single-use.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing)
      throw ApiException.conflict('EMAIL_TAKEN', 'An account with this email already exists');
    if (dto.phone) {
      const phoneOwner = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneOwner)
        throw ApiException.conflict('PHONE_TAKEN', 'An account with this phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName.trim(),
        phone: dto.phone ?? null,
        locale: dto.locale ?? 'fa-IR',
      },
    });
    this.logger.log(`Registered user ${user.email}`);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    // Uniform error for unknown email vs wrong password (no account oracle).
    if (!user || !user.isActive) {
      throw ApiException.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw ApiException.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: { sub?: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw ApiException.unauthorized(
        'INVALID_REFRESH_TOKEN',
        'Refresh token is invalid or expired',
      );
    }
    if (!payload.sub)
      throw ApiException.unauthorized('INVALID_REFRESH_TOKEN', 'Malformed refresh token');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.revokedAt ||
      stored.expiresAt < new Date()
    ) {
      throw ApiException.unauthorized(
        'INVALID_REFRESH_TOKEN',
        'Refresh token is invalid or expired',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.isActive)
      throw ApiException.unauthorized('INVALID_CREDENTIALS', 'Account is disabled');

    // Rotate: revoke the used token, then issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiException.notFound('USER_NOT_FOUND', 'User no longer exists');
    return toUserDto(user);
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti: randomBytes(16).toString('hex') },
      {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_TTL as JwtSignOptions['expiresIn'],
      },
    );

    const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
    });

    // Opportunistic cleanup of spent/expired rows.
    void this.prisma.refreshToken
      .deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { createdAt: { lt: new Date(Date.now() - 30 * 864e5) } },
          ],
        },
      })
      .catch((error: unknown) =>
        this.logger.debug(`refresh token cleanup failed: ${String(error)}`),
      );

    return { user: toUserDto(user), accessToken, refreshToken };
  }
}

/** Supports the small set of TTL formats used in config (s/m/h/d). */
export function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 7 * 864e5;
  const value = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1e3 : unit === 'm' ? 6e4 : unit === 'h' ? 36e5 : 864e5;
  return value * factor;
}
