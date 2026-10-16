/**
 * Generates the canonical OpenAPI document at docs/openapi.json.
 *
 * Runs the real app (without listening) through `nest build` so the Swagger
 * CLI plugin is applied to DTOs — the exported contract therefore matches the
 * deployed API byte-for-byte. The shared api-client types are regenerated
 * from this file (`bun run openapi:client`).
 */
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AppModule } from '../app.module';
import { buildSwaggerDocument, configureApp } from '../setup';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const document = buildSwaggerDocument(app);

  const outFile = path.resolve(process.cwd(), '../../docs/openapi.json');
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`);

  console.info(`OpenAPI document written to ${outFile}`);
  console.info(`Paths: ${Object.keys(document.paths).length}`);

  await app.close();
}

main().catch((error: unknown) => {
  console.error('OpenAPI generation failed:', error);
  process.exit(1);
});
