import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma ORM 7 configuration (see https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference).
 *
 * The CLI database URL lives here (not in schema.prisma). It falls back to the
 * local embedded-PostgreSQL default so that `prisma generate` works on a fresh
 * checkout before any .env file exists.
 */
const fallbackUrl = 'postgresql://postgres:postgres@127.0.0.1:5433/mehrwearing';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackUrl,
  },
});
