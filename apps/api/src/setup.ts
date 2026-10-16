import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { corsOrigins, env } from './common/config/env';
import { ApiException } from './common/http/api-exception';
import { HttpExceptionFilter } from './common/http/http-exception.filter';

/**
 * Single place where the HTTP pipeline is configured. main.ts, the e2e suite
 * and the OpenAPI generator all call this, so tests exercise production
 * behaviour (validation, error envelope, CORS, helmet) exactly.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI ships its own assets
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => ApiException.validation(errors),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  return app;
}

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('MehrWearingShopping API')
    .setDescription(
      'API-first commerce API for the MehrWearingShopping men’s fashion store. ' +
        'Serves the Persian/English web storefront and any mobile or desktop client. ' +
        'Authenticate with the Bearer token returned by /auth/login.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addTag('auth', 'Registration, login, token rotation')
    .addTag('catalog', 'Categories, brands')
    .addTag('products', 'Catalog listing, search, details, reviews')
    .addTag('cart', 'Server-side carts (guest + signed-in)')
    .addTag('orders', 'Checkout, order history, tracking')
    .addTag('payments', 'Gateway redirects and callbacks')
    .addTag('coupons', 'Coupon preview')
    .addTag('reviews', 'Product reviews')
    .addTag('wishlist', 'Saved products')
    .addTag('users', 'Profile and addresses')
    .addTag('admin', 'Back-office endpoints (ADMIN role)')
    .addTag('health', 'Probes')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.servers = [{ url: `${env.API_BASE_URL}/api/v1`, description: 'v1' }];
  return document;
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = buildSwaggerDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MehrWearingShopping API',
    swaggerOptions: { persistAuthorization: true },
  });
  return document;
}
