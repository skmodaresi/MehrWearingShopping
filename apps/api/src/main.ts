import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './common/config/env';
import { configureApp, setupSwagger } from './setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);
  await app.listen(env.PORT, '0.0.0.0');

  console.info(`MehrWearingShopping API  →  ${env.API_BASE_URL}`);
  console.info(`OpenAPI / Swagger UI    →  ${env.API_BASE_URL}/api/docs`);
  console.info(`Health probe            →  ${env.API_BASE_URL}/health`);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal bootstrap error', error);
  process.exit(1);
});
