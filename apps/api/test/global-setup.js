/**
 * Jest global setup for the e2e suite.
 *
 * Strategy (in order of preference):
 *  1. Reuse an already-running PostgreSQL at DATABASE_URL_TEST
 *     (CI can point this at a service container).
 *  2. Otherwise boot an embedded PostgreSQL 17 on port 5434 — no Docker,
 *     no root, self-contained.
 *
 * Then applies migrations and seeds the demo catalog into the throwaway
 * database, so tests run against exactly the data customers would see.
 *
 * Written in plain JS on purpose: it must run before any TypeScript
 * compilation and the embedded-postgres package is ESM-only.
 */
const path = require('node:path');
const { execSync } = require('node:child_process');
const { Client } = require('pg');

const TEST_URL =
  process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@127.0.0.1:5434/mehrwearing_test';
const TEST_PORT = Number(new URL(TEST_URL).port || 5434);
const TEST_DB = new URL(TEST_URL).pathname.replace(/^\//, '') || 'mehrwearing_test';

async function canConnect(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query('select 1');
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      /* already closed */
    }
    return false;
  }
}

module.exports = async function globalSetup() {
  // Every child process (jest workers, prisma CLI) talks to the test database.
  process.env.DATABASE_URL = TEST_URL;

  if (!(await canConnect(TEST_URL))) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const pg = new EmbeddedPostgres({
      databaseDir: path.resolve(__dirname, '../.pgdata-test'),
      user: 'postgres',
      password: 'postgres',
      port: TEST_PORT,
      persistent: true,
    });
    try {
      await pg.initialise();
    } catch {
      /* cluster already initialised from a previous run */
    }
    await pg.start();
    try {
      await pg.createDatabase(TEST_DB);
    } catch {
      /* database already exists */
    }
    global.__e2ePostgres = pg;
    // Give the accept loop a beat before the first migration connects.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const env = { ...process.env, DATABASE_URL: TEST_URL };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx prisma db seed', { stdio: 'inherit', env });
};
