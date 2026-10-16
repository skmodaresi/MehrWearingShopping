import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment contract for the API. Every value has a development-friendly
 * default so a fresh clone boots with zero configuration; production must
 * override secrets (validated below).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@127.0.0.1:5433/mehrwearing'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-000000000000000000'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-1111111111111111'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  SHIPPING_STANDARD_COST: z.coerce.number().int().nonnegative().default(35000),
  SHIPPING_EXPRESS_COST: z.coerce.number().int().nonnegative().default(89000),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().int().nonnegative().default(1500000),

  PAYMENT_PROVIDER: z.enum(['mock', 'zarinpal']).default('mock'),
  ZARINPAL_MERCHANT_ID: z.string().optional().default(''),
  ZARINPAL_CALLBACK_URL: z
    .string()
    .optional()
    .default('http://localhost:4000/api/v1/payments/zarinpal/callback'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@mehrwearing.ir'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe!Admin123'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
  );
  throw new Error(
    `Invalid environment configuration:\n${issues.join('\n')}\n\nSee apps/api/.env.example.`,
  );
}

export const env = parsed.data;

if (env.NODE_ENV === 'production') {
  const devMarkers = ['change-me', 'dev-access', 'dev-refresh'];
  const insecure = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET].some((secret) =>
    devMarkers.some((marker) => secret.includes(marker)),
  );
  if (insecure) {
    throw new Error(
      'Refusing to start in production with development JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.',
    );
  }
}

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
