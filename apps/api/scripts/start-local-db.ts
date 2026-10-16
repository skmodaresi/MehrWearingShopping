/**
 * Starts a real, local PostgreSQL server without Docker or root access.
 *
 * Uses the `embedded-postgres` package (official PostgreSQL binaries) and
 * keeps running until you press Ctrl+C, exactly like a normal database
 * server. Data persists in apps/api/.pgdata-dev between runs.
 *
 *   bun run db:start          # from the repository root
 *   PG_PORT=5440 bun run db:start
 *
 * Default connection string (what apps/api/.env expects):
 *   postgresql://postgres:postgres@127.0.0.1:5433/mehrwearing
 */
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.PG_PORT ?? 5433);
const database = process.env.PG_DATABASE ?? 'mehrwearing';
const databaseDir = path.resolve(process.cwd(), process.env.PG_DATA_DIR ?? '.pgdata-dev');

async function main(): Promise<void> {
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch {
    // Cluster already initialised in a previous run — that is fine.
  }

  await pg.start();

  try {
    await pg.createDatabase(database);
  } catch {
    // Database already exists.
  }

  console.info(`\n✔ PostgreSQL 17 running on 127.0.0.1:${port} (data: ${databaseDir})`);
  console.info(`  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/${database}`);
  console.info('  Press Ctrl+C to stop.\n');

  const shutdown = async (): Promise<void> => {
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive until a signal arrives.
  setInterval(() => undefined, 1 << 30);
}

main().catch((error: unknown) => {
  console.error('Failed to start embedded PostgreSQL:', error);
  process.exit(1);
});
