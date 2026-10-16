import { ApiError, createApiClient, FetchLike } from './index';

/**
 * The client is exercised against a fake transport: these tests pin down the
 * request contract (URLs, headers, bodies) and the error envelope mapping —
 * the same things a mobile or desktop integration depends on.
 */

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function fakeFetch(
  responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>,
) {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body: init?.body as string | undefined,
    });
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    const body = next.body ?? {};
    return new Response(JSON.stringify(body), {
      status: next.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...(next.headers ?? {}) },
    });
  };
  return { calls, fetchImpl };
}

describe('createApiClient', () => {
  it('serializes list queries (arrays joined, empties dropped)', async () => {
    const { calls, fetchImpl } = fakeFetch([
      { body: { items: [], total: 0, page: 1, pages: 1, limit: 20 } },
    ]);
    const client = createApiClient({ baseUrl: 'http://api.test/api/v1/', fetch: fetchImpl });

    await client.catalog.products({
      category: 'jeans',
      sizes: ['M', 'L'],
      page: 2,
      q: undefined,
      minPrice: 0,
    });

    expect(calls[0].url).toBe(
      'http://api.test/api/v1/products?category=jeans&sizes=M%2CL&page=2&minPrice=0',
    );
  });

  it('sends Authorization and x-cart-id headers when configured', async () => {
    const { calls, fetchImpl } = fakeFetch([
      { body: { cartId: 'cart-1', items: [], itemCount: 0, subtotalToman: 0 } },
    ]);
    let cartId: string | undefined;
    const client = createApiClient({
      baseUrl: 'http://api.test/api/v1',
      fetch: fetchImpl,
      getToken: () => 'jwt-token',
      getCartId: () => cartId,
      onCartId: (id) => {
        cartId = id;
      },
    });

    await client.cart.get();
    expect(calls[0].headers.Authorization).toBe('Bearer jwt-token');
    expect(calls[0].headers['x-cart-id']).toBeUndefined();

    // API issued a cart id in the response; it must be echoed from now on.
    expect(cartId).toBe('cart-1');
    await client.cart.addItem('variant-1', 2);
    expect(calls[1].headers['x-cart-id']).toBe('cart-1');
    expect(JSON.parse(calls[1].body!)).toEqual({ variantId: 'variant-1', qty: 2 });
  });

  it('stores tokens returned by login through onTokens', async () => {
    const auth = {
      user: {
        id: 'u1',
        email: 'a@b.c',
        fullName: 'Ali',
        phone: null,
        role: 'CUSTOMER',
        locale: 'fa-IR',
        createdAt: '',
      },
      accessToken: 'ACCESS',
      refreshToken: 'REFRESH',
    };
    const { fetchImpl } = fakeFetch([{ body: auth }]);
    let received: unknown = null;
    const client = createApiClient({
      baseUrl: 'http://api.test/api/v1',
      fetch: fetchImpl,
      onTokens: (tokens) => {
        received = tokens;
      },
    });

    await client.auth.login({ email: 'a@b.c', password: 'Password123' });
    expect(received).toEqual(auth);
  });

  it('normalizes error envelopes into ApiError with server codes', async () => {
    const { fetchImpl } = fakeFetch([
      {
        status: 409,
        body: {
          statusCode: 409,
          code: 'OUT_OF_STOCK',
          message: 'Not enough stock',
          details: { available: 2 },
        },
      },
    ]);
    const client = createApiClient({ baseUrl: 'http://api.test/api/v1', fetch: fetchImpl });

    await expect(client.cart.addItem('v', 10)).rejects.toBeInstanceOf(ApiError);
    await client.cart.addItem('v', 10).catch((error: unknown) => {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.code).toBe('OUT_OF_STOCK');
      expect(apiError.is('OUT_OF_STOCK', 'PRODUCT_UNAVAILABLE')).toBe(true);
      expect(apiError.details).toEqual({ available: 2 });
    });
  });

  it('maps 5xx and non-JSON bodies to a safe fallback code', async () => {
    const { fetchImpl } = fakeFetch([{ status: 500, body: 'boom' }]);
    const client = createApiClient({ baseUrl: 'http://api.test/api/v1', fetch: fetchImpl });
    await client.catalog.categories().catch((error: unknown) => {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(500);
      expect(apiError.code).toBe('UNKNOWN_ERROR');
    });
  });

  it('passes locale headers for checkout so orders record the language', async () => {
    const order = { orderNumber: 'MW-1' };
    const { calls, fetchImpl } = fakeFetch([{ body: order }]);
    const client = createApiClient({ baseUrl: 'http://api.test/api/v1', fetch: fetchImpl });

    await client.orders.place({ addressId: 'a1', shippingMethod: 'STANDARD' }, 'en');
    expect(calls[0].headers['x-locale']).toBe('en');
    expect(calls[0].method).toBe('POST');
  });

  it('percent-encodes slugs in product URLs', async () => {
    const { calls, fetchImpl } = fakeFetch([{ body: {} }]);
    const client = createApiClient({ baseUrl: 'http://api.test/api/v1', fetch: fetchImpl });
    await client.catalog.product('slim fit/jeans'.replace(/ /g, '-'));
    expect(calls[0].url).toContain('/products/slim-fit%2Fjeans');
  });
});
