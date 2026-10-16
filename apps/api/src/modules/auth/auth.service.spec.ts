import { AuthService } from './auth.service';
import { ApiException } from '../../common/http/api-exception';

/**
 * AuthService unit tests with an in-memory Prisma double — no database.
 * Covers the security-relevant behaviour: uniform credential errors,
 * disabled accounts, and refresh-token rotation.
 */
type UserRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'ADMIN' | 'CUSTOMER';
  locale: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
};

function makeUser(email: string, passwordHash: string): UserRow {
  return {
    id: `u-${email}`,
    email,
    fullName: 'Test User',
    phone: null,
    role: 'CUSTOMER',
    locale: 'fa-IR',
    passwordHash,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function makeService(users: UserRow[]) {
  const refreshTokens = new Map<
    string,
    { id: string; userId: string; revokedAt: Date | null; expiresAt: Date }
  >();

  const prisma = {
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { email?: string; phone?: string; id?: string } }) => {
          if (where.email) return users.find((u) => u.email === where.email) ?? null;
          if (where.id) return users.find((u) => u.id === where.id) ?? null;
          return null;
        },
      ),
      create: jest.fn(async ({ data }: { data: Partial<UserRow> }) => {
        const user = makeUser(data.email!, 'HASHED');
        users.push(user);
        return user;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error('not found');
        return user;
      }),
    },
    refreshToken: {
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const row = refreshTokens.get(where.tokenHash);
        return row
          ? { id: row.id, userId: row.userId, revokedAt: row.revokedAt, expiresAt: row.expiresAt }
          : null;
      }),
      create: jest.fn(
        async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
          refreshTokens.set(data.tokenHash, {
            id: `rt-${refreshTokens.size}`,
            userId: data.userId,
            revokedAt: null,
            expiresAt: data.expiresAt,
          });
          return data;
        },
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
          for (const [key, value] of refreshTokens) {
            if (value.id === where.id)
              refreshTokens.set(key, { ...value, revokedAt: data.revokedAt });
          }
          return null;
        },
      ),
      updateMany: jest.fn(async () => ({ count: 1 })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };

  const jwt = {
    signAsync: jest.fn(
      async (payload: unknown, options?: { expiresIn?: string }) =>
        `token.${Buffer.from(JSON.stringify({ payload, exp: options?.expiresIn })).toString('base64url')}`,
    ),
    verifyAsync: jest.fn(async (token: string) => {
      if (!token.startsWith('token.')) throw new Error('invalid');
      const parsed = JSON.parse(Buffer.from(token.slice(6), 'base64url').toString()) as {
        payload: { sub?: string };
        exp: string;
      };
      if (parsed.payload.sub === undefined) throw new Error('malformed');
      return parsed.payload;
    }),
  };

  return { service: new AuthService(prisma as never, jwt as never), prisma, jwt, refreshTokens };
}

describe('AuthService', () => {
  it('registers a user and returns a token pair', async () => {
    const { service } = makeService([]);
    const result = await service.register({
      email: 'New@Example.com',
      password: 'Password123',
      fullName: 'کاربر تازه',
    });
    expect(result.user.email).toBe('new@example.com'); // lowercased
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects duplicate registration with EMAIL_TAKEN', async () => {
    const { service } = makeService([makeUser('taken@example.com', 'x')]);
    await expect(
      service.register({ email: 'taken@example.com', password: 'Password123', fullName: 'Ali' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('returns a uniform error for unknown email and wrong password', async () => {
    const { service } = makeService([makeUser('a@example.com', 'HASHED')]);
    const wrongPassword = { email: 'a@example.com', password: 'Nope1234567' };
    const unknownEmail = { email: 'ghost@example.com', password: 'Nope1234567' };

    const first = await service.login(wrongPassword).catch((error: unknown) => error);
    const second = await service.login(unknownEmail).catch((error: unknown) => error);

    expect(first).toBeInstanceOf(ApiException);
    expect(second).toBeInstanceOf(ApiException);
    expect((first as ApiException).getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect((second as ApiException).getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('refuses to log in a disabled account', async () => {
    const disabled = { ...makeUser('disabled@example.com', 'HASHED'), isActive: false };
    const { service } = makeService([disabled]);
    await expect(
      service.login({ email: 'disabled@example.com', password: 'whatever-is-hashed' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rotates refresh tokens: the used token stops working', async () => {
    const bcryptHash = await import('bcryptjs').then((m) => m.default.hash('Password123', 4));
    const { service } = makeService([makeUser('rotate@example.com', bcryptHash)]);

    const first = await service.login({ email: 'rotate@example.com', password: 'Password123' });
    const rotated = await service.refresh(first.refreshToken);
    expect(rotated.accessToken).toBeTruthy();

    // Replaying the old token must fail (single-use rotation).
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
    // The new token still works once.
    await expect(service.refresh(rotated.refreshToken)).resolves.toHaveProperty('accessToken');
  });
});
