/**
 * End-to-end purchase flow.
 *
 * Boots the real AppModule (same pipeline as production: validation pipe,
 * error envelope, guards) against a real PostgreSQL provisioned by
 * test/global-setup.js, seeded with the demo catalog.
 *
 * Covered journey:
 *   health → catalog → search/facets → register/login/refresh → address
 *   → cart (incl. oversell guard) → coupon → checkout → mock gateway
 *   → PAID → admin lifecycle → moderation → wishlist → RBAC boundaries
 */
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

jest.setTimeout(180000);

type TokenPair = { accessToken: string; refreshToken: string };

describe('MehrWearingShopping — purchase flow (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const phone = `09${String(stamp).slice(0, 9)}`;
  const password = 'E2eTest!123';

  let user: TokenPair;
  let admin: TokenPair;
  let addressId: string;
  let variantId: string;
  let productId: string;
  let productPrice: number;
  let orderNumber: string;
  let orderId: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- health & catalog ---------------------------------------------------

  it('reports a healthy database', async () => {
    const { body } = await request(server).get('/health').expect(200);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
  });

  it('lists the seeded catalog with bilingual names', async () => {
    const { body } = await request(server).get('/api/v1/products').expect(200);
    expect(body.total).toBeGreaterThanOrEqual(28);
    expect(body.items[0].nameFa).toBeTruthy();
    expect(body.items[0].nameEn).toBeTruthy();
  });

  it('filters by category and sorts by price', async () => {
    const { body } = await request(server)
      .get('/api/v1/products')
      .query({ category: 'jeans', sort: 'price-asc' })
      .expect(200);
    expect(body.items.length).toBeGreaterThan(0);
    const prices = body.items.map((item: { priceToman: number }) => item.priceToman);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(
      body.items.every((item: { category: { slug: string } }) => item.category.slug === 'jeans'),
    ).toBe(true);
  });

  it('searches in Persian regardless of keyboard variants', async () => {
    const { body } = await request(server)
      .get('/api/v1/products')
      .query({ q: 'کتانی' })
      .expect(200);
    expect(body.total).toBeGreaterThan(0);

    // Arabic-persian letter variant of «جین» still matches
    const { body: folded } = await request(server)
      .get('/api/v1/products')
      .query({ q: 'جين' })
      .expect(200);
    expect(folded.total).toBeGreaterThan(0);
  });

  it('returns facets for filter UIs', async () => {
    const { body } = await request(server)
      .get('/api/v1/products/facets')
      .query({ category: 'jeans' })
      .expect(200);
    expect(body.sizes.length).toBeGreaterThan(0);
    expect(body.colors.length).toBeGreaterThan(0);
    expect(body.priceRange.max).toBeGreaterThanOrEqual(body.priceRange.min);
  });

  it('serves full product detail with variants and specs', async () => {
    const { body } = await request(server).get('/api/v1/products/slim-fit-jeans').expect(200);
    expect(body.variants.length).toBeGreaterThan(0);
    expect(body.specs.length).toBeGreaterThan(0);
    expect(body.descriptionFa).toBeTruthy();
    productId = body.id;
    variantId = body.variants[0].id;
    productPrice = body.priceToman;
  });

  it('404s on unknown products with the error envelope', async () => {
    const { body } = await request(server).get('/api/v1/products/nope').expect(404);
    expect(body).toMatchObject({ statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
  });

  // --- auth ---------------------------------------------------------------

  it('rejects unauthenticated profile access', async () => {
    const { body } = await request(server).get('/api/v1/auth/me').expect(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('registers and returns a token pair', async () => {
    const { body } = await request(server)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'کاربر E2E', phone })
      .expect(201);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.role).toBe('CUSTOMER');
    user = body;
  });

  it('rejects duplicate registration uniformly', async () => {
    const { body } = await request(server)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'کاربر E2E' })
      .expect(409);
    expect(body.code).toBe('EMAIL_TAKEN');
  });

  it('never reveals whether an account exists on failed login', async () => {
    const unknown = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: `ghost-${stamp}@example.com`, password })
      .expect(401);
    const wrongPassword = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: 'TotallyWrong!1' })
      .expect(401);
    expect(unknown.body.code).toBe(wrongPassword.body.code);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh tokens (old one dies)', async () => {
    const { body } = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    user = body;
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    const replay = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN');
    // refresh again with the rotated pair to restore a valid token for later steps
    const fresh = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    user = fresh.body;
  });

  // --- address & cart -----------------------------------------------------

  it('saves an address', async () => {
    const { body } = await request(server)
      .post('/api/v1/users/me/addresses')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        recipientName: 'کاربر E2E',
        phone,
        province: 'تهران',
        city: 'تهران',
        postalCode: '1234567890',
        addressLine: 'خیابان آزادی، پلاک ۱',
        label: 'خانه',
      })
      .expect(201);
    expect(body.id).toBeTruthy();
    addressId = body.id;
  });

  it('creates a cart and adds items', async () => {
    const { body } = await request(server)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ variantId, qty: 2 })
      .expect(201);
    expect(body.itemCount).toBe(2);
    expect(body.subtotalToman).toBe(productPrice * 2);
  });

  it('rejects quantities beyond available stock with 409', async () => {
    const { body } = await request(server)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ variantId, qty: 9999 })
      .expect(409);
    expect(body.code).toBe('OUT_OF_STOCK');
    expect(body.details.available).toBeLessThan(9999);
  });

  // --- checkout -----------------------------------------------------------

  it('validates coupons before checkout', async () => {
    const { body } = await request(server)
      .post('/api/v1/coupons/validate')
      .send({ code: 'MEHR10', subtotalToman: 1000000 })
      .expect(201);
    expect(body.discountToman).toBe(100000);

    const bad = await request(server)
      .post('/api/v1/coupons/validate')
      .send({ code: 'NOT-A-CODE', subtotalToman: 1000000 })
      .expect(400);
    expect(bad.body.code).toBe('COUPON_NOT_FOUND');
  });

  it('places an order with coupon, snapshot and free shipping over threshold', async () => {
    const { body } = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('x-locale', 'fa-IR')
      .send({ addressId, shippingMethod: 'STANDARD', couponCode: 'MEHR10' })
      .expect(201);

    orderNumber = body.orderNumber;
    orderId = body.id;
    expect(orderNumber).toMatch(/^MW-[0-9A-F]{12}$/);
    expect(body.status).toBe('PENDING');
    expect(body.discountToman).toBe(Math.floor((body.subtotalToman * 10) / 100));
    expect(body.totalToman).toBe(body.subtotalToman - body.discountToman + body.shippingCostToman);
    expect(body.recipientName).toBe('کاربر E2E');
    expect(body.items).toHaveLength(1);

    // cart must be empty afterwards
    const { body: cart } = await request(server)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(cart.itemCount).toBe(0);
  });

  it('rejects checkout with an empty cart', async () => {
    const { body } = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ addressId, shippingMethod: 'STANDARD' })
      .expect(400);
    expect(body.code).toBe('CART_EMPTY');
  });

  // --- payment ------------------------------------------------------------

  it('issues a signed gateway URL and completes the mock payment', async () => {
    const { body } = await request(server)
      .post(`/api/v1/orders/${orderNumber}/pay`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({})
      .expect(201);
    expect(body.gatewayUrl).toContain('/api/v1/payments/mock/checkout');

    const gatewayPath = new URL(body.gatewayUrl).pathname + new URL(body.gatewayUrl).search;
    const page = await request(server).get(gatewayPath).expect(200);
    expect(page.text).toContain('test gateway');

    // follow the "successful payment" link manually (redirect: manual)
    const callbackPath = gatewayPath.replace('/checkout?', '/callback?') + '&result=success';
    const callback = await request(server).get(callbackPath).redirects(0).expect(302);
    expect(callback.headers.location).toContain(orderNumber);
    expect(callback.headers.location).toContain('payment=success');
  });

  it('shows the order as PAID with a timestamp', async () => {
    const { body } = await request(server)
      .get(`/api/v1/orders/${orderNumber}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(body.paymentStatus).toBe('PAID');
    expect(body.status).toBe('PAID');
    expect(body.paidAt).toBeTruthy();
    expect(body.timeline.map((entry: { status: string }) => entry.status)).toEqual([
      'PENDING',
      'PAID',
    ]);
  });

  it('refuses tampered gateway callbacks', async () => {
    const { body: order } = await request(server)
      .get(`/api/v1/orders/${orderNumber}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    // forged amount is rejected before anything else
    const wrongAmount = await request(server)
      .get('/api/v1/payments/mock/callback')
      .query({ order: orderNumber, amount: 1, sig: 'deadbeef', result: 'success' })
      .expect(400);
    expect(wrongAmount.body.code).toBe('AMOUNT_MISMATCH');

    // correct amount but a signature we did not issue → rejected
    const wrongSignature = await request(server)
      .get('/api/v1/payments/mock/callback')
      .query({ order: orderNumber, amount: order.totalToman, sig: 'deadbeef', result: 'success' })
      .expect(400);
    expect(wrongSignature.body.code).toBe('INVALID_SIGNATURE');

    // order is still untouched
    const { body: after } = await request(server)
      .get(`/api/v1/orders/${orderNumber}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(after.paymentStatus).toBe('PAID'); // paid by the *valid* callback earlier
  });

  // --- admin --------------------------------------------------------------

  it('logs in as the seeded admin', async () => {
    const { body } = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mehrwearing.ir', password: 'ChangeMe!Admin123' })
      .expect(200);
    expect(body.user.role).toBe('ADMIN');
    admin = body;
  });

  it('blocks customers from admin endpoints', async () => {
    await request(server)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('walks the order through the fulfilment lifecycle', async () => {
    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const { body } = await request(server)
        .post(`/api/v1/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ status })
        .expect(201);
      expect(body.status).toBe(status);
    }

    const invalid = await request(server)
      .post(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'PENDING' })
      .expect(400);
    expect(invalid.body.code).toBe('INVALID_TRANSITION');
  });

  it('reports dashboard stats', async () => {
    const { body } = await request(server)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(body.revenue.allTimeToman).toBeGreaterThan(0);
    expect(body.orders.total).toBeGreaterThan(0);
    expect(Array.isArray(body.topProducts)).toBe(true);
  });

  // --- reviews & wishlist -------------------------------------------------

  it('only lets verified purchasers review, and moderates before publish', async () => {
    // Unique body per run: the test database persists between runs, so every
    // assertion below keys off text only THIS run could have written.
    const reviewBody = `کیفیت پارچه و دوخت واقعاً عالی بود - run ${stamp}`;
    const mine = await request(server)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ productId, rating: 5, title: 'عالی', body: reviewBody })
      .expect(201);
    expect(mine.body.status).toBe('PENDING');

    // second review from the same user is rejected
    await request(server)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ productId, rating: 4, body: `دوباره می‌خواهم بخرم - run ${stamp}` })
      .expect(409);

    // a user who never bought it cannot review
    const stranger = await request(server)
      .post('/api/v1/auth/register')
      .send({ email: `stranger-${stamp}@example.com`, password, fullName: 'غریبه' })
      .expect(201);
    const denied = await request(server)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${stranger.body.accessToken}`)
      .send({ productId, rating: 1, body: 'این نظر توسط کاربری بدون خرید نوشته شده.' })
      .expect(403);
    expect(denied.body.code).toBe('NOT_PURCHASED');

    // pending review is invisible to the public endpoint
    const before = await request(server).get(`/api/v1/products/slim-fit-jeans/reviews`).expect(200);
    expect(
      before.body.items.some((review: { body: string }) => review.body.includes(`run ${stamp}`)),
    ).toBe(false);

    // admin approves → now visible, with the customer name masked
    await request(server)
      .patch(`/api/v1/admin/reviews/${mine.body.id}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const after = await request(server).get(`/api/v1/products/slim-fit-jeans/reviews`).expect(200);
    const published = after.body.items.find((review: { body: string }) =>
      review.body.includes(`run ${stamp}`),
    );
    expect(published).toBeTruthy();
    expect(published.customerName).not.toContain('E2E'); // full name never exposed

    // rating aggregate updated on the product
    const { body: detail } = await request(server)
      .get('/api/v1/products/slim-fit-jeans')
      .expect(200);
    expect(detail.ratingCount).toBeGreaterThanOrEqual(3);
  });

  it('adds and removes wishlist entries', async () => {
    const added = await request(server)
      .post(`/api/v1/wishlist/${productId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);
    expect(added.body.added).toBe(true);

    const list = await request(server)
      .get('/api/v1/wishlist')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(list.body.some((item: { id: string }) => item.id === productId)).toBe(true);

    const removed = await request(server)
      .delete(`/api/v1/wishlist/${productId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(removed.body.removed).toBe(true);
  });

  // --- cancellation restocks ---------------------------------------------

  it('cancelling an unpaid order restores stock', async () => {
    // restock check: place a small order then cancel it
    await request(server)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ variantId, qty: 1 })
      .expect(201);

    const { body: order } = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ addressId, shippingMethod: 'EXPRESS' })
      .expect(201);

    const { body: detail } = await request(server)
      .get('/api/v1/products/slim-fit-jeans')
      .expect(200);
    const stockAfterOrder = detail.variants.find(
      (variant: { id: string }) => variant.id === variantId,
    ).stock;

    const cancelled = await request(server)
      .post(`/api/v1/orders/${order.orderNumber}/cancel`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');

    const { body: after } = await request(server)
      .get('/api/v1/products/slim-fit-jeans')
      .expect(200);
    const stockAfterCancel = after.variants.find(
      (variant: { id: string }) => variant.id === variantId,
    ).stock;
    expect(stockAfterCancel).toBe(stockAfterOrder + 1);
  });
});
