/**
 * Isomorphic typed client for the MehrWearingShopping API.
 *
 * Works unchanged in browsers, React Native and Node (desktop apps):
 *  - uses the platform `fetch` (injectable for tests / custom agents),
 *  - no DOM or Node-only APIs,
 *  - carries the Bearer token and guest cart id through the hooks you provide,
 *  - normalizes every HTTP failure into a typed {@link ApiError} whose `code`
 *    matches the server's machine-readable error codes (translate those in
 *    your i18n layer).
 */
import type {
  Address,
  AddressInput,
  AdminProductRow,
  AdminStats,
  AuthResponse,
  Brand,
  Cart,
  Category,
  CouponPreview,
  Facets,
  Order,
  OrderStatus,
  Paged,
  PlaceOrderInput,
  ProductCard,
  ProductDetail,
  ProductListQuery,
  Review,
  StartPayment,
  User,
} from './types';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Base URL including the version prefix, e.g. `http://localhost:4000/api/v1` */
  baseUrl: string;
  /** Defaults to global fetch. Pass your own for tests or React Native. */
  fetch?: FetchLike;
  /** Return the current access token (or null when signed out). */
  getToken?: () => string | null | undefined;
  /** Return the guest cart id issued by the API (or null before the first call). */
  getCartId?: () => string | null | undefined;
  /** Called after login/register/refresh/logout so the host app can persist tokens. */
  onTokens?: (tokens: AuthResponse | null) => void;
  /** Called whenever the API issues or changes the cart id (guest carts). */
  onCartId?: (cartId: string) => void;
  /** Extra headers applied to every request (e.g. `x-locale: fa-IR`). */
  defaultHeaders?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Convenience: does this error match one of the app's known codes? */
  is(...codes: string[]): boolean {
    return codes.includes(this.code);
  }
}

type QueryValue = string | number | boolean | string[] | undefined | null;

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(
    method: string,
    path: string,
    config: {
      body?: unknown;
      query?: Record<string, QueryValue>;
      auth?: boolean;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = `${baseUrl}${path}${buildQuery(config.query)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.defaultHeaders,
      ...config.headers,
    };
    if (config.body !== undefined) headers['Content-Type'] = 'application/json';

    const token = options.getToken?.();
    if (config.auth !== false && token) headers.Authorization = `Bearer ${token}`;

    const cartId = options.getCartId?.();
    if (cartId) headers['x-cart-id'] = cartId;

    const response = await doFetch(url, {
      method,
      headers,
      body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
    });

    // Track cart id whenever the API returns one (guest carts).
    const responseCartId = response.headers.get('x-cart-id');
    if (responseCartId) options.onCartId?.(responseCartId);

    const text = await response.text();
    const payload: unknown = text ? safeJson(text) : null;

    if (!response.ok) {
      const envelope = (payload ?? {}) as { code?: string; message?: string; details?: unknown };
      throw new ApiError(
        response.status,
        envelope.code ?? 'UNKNOWN_ERROR',
        envelope.message ?? `Request failed with status ${response.status}`,
        envelope.details,
      );
    }
    return payload as T;
  }

  const get = <T>(path: string, query?: Record<string, QueryValue>, auth?: boolean) =>
    request<T>('GET', path, { query, auth });
  const post = <T>(path: string, body?: unknown, auth?: boolean) =>
    request<T>('POST', path, { body, auth });
  const patch = <T>(path: string, body?: unknown, auth?: boolean) =>
    request<T>('PATCH', path, { body, auth });
  const del = <T>(path: string, auth?: boolean) => request<T>('DELETE', path, { auth });

  function withTokens(response: AuthResponse): AuthResponse {
    options.onTokens?.(response);
    return response;
  }

  /** Cart endpoints return `{cartId}` — hand it back to the host app. */
  function trackCart<T extends { cartId?: string }>(promise: Promise<T>): Promise<T> {
    return promise.then((data) => {
      if (data.cartId) options.onCartId?.(data.cartId);
      return data;
    });
  }

  return {
    /** Raw escape hatch for endpoints added after this client was generated. */
    request,

    auth: {
      register: (input: {
        email: string;
        password: string;
        fullName: string;
        phone?: string;
        locale?: string;
      }) => post<AuthResponse>('/auth/register', input, false).then(withTokens),
      login: (input: { email: string; password: string }) =>
        post<AuthResponse>('/auth/login', input, false).then(withTokens),
      refresh: (refreshToken: string) =>
        post<AuthResponse>('/auth/refresh', { refreshToken }, false).then(withTokens),
      logout: async (refreshToken: string) => {
        await post<{ success: true }>('/auth/logout', { refreshToken }, false);
        options.onTokens?.(null);
      },
      me: () => get<User>('/auth/me'),
    },

    catalog: {
      categories: () => get<Category[]>('/categories'),
      category: (slug: string) => get<Category>(`/categories/${encodeURIComponent(slug)}`),
      brands: () => get<Brand[]>('/brands'),
      products: (query: ProductListQuery = {}) =>
        get<Paged<ProductCard>>('/products', query as Record<string, QueryValue>),
      featured: () => get<Paged<ProductCard>>('/products/featured'),
      deals: () => get<Paged<ProductCard>>('/products/deals'),
      facets: (query: { category?: string; brand?: string; q?: string } = {}) =>
        get<Facets>('/products/facets', query),
      product: (slug: string) => get<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
      related: (slug: string) =>
        get<ProductCard[]>(`/products/${encodeURIComponent(slug)}/related`),
      reviews: (slug: string, page = 1, limit = 10) =>
        get<Paged<Review>>(`/products/${encodeURIComponent(slug)}/reviews`, { page, limit }, false),
    },

    cart: {
      get: () => trackCart(get<Cart>('/cart')),
      addItem: (variantId: string, qty = 1) =>
        trackCart(post<Cart>('/cart/items', { variantId, qty })),
      updateItem: (variantId: string, qty: number) =>
        trackCart(patch<Cart>(`/cart/items/${variantId}`, { qty })),
      removeItem: (variantId: string) => trackCart(del<Cart>(`/cart/items/${variantId}`)),
    },

    coupons: {
      validate: (code: string, subtotalToman: number) =>
        post<CouponPreview>('/coupons/validate', { code, subtotalToman }, false),
    },

    orders: {
      place: (input: PlaceOrderInput, locale?: string) =>
        request<Order>('POST', '/orders', {
          body: input,
          headers: locale ? { 'x-locale': locale } : undefined,
        }),
      list: (page = 1, limit = 10) => get<Paged<Order>>('/orders', { page, limit }),
      get: (orderNumber: string) => get<Order>(`/orders/${encodeURIComponent(orderNumber)}`),
      cancel: (orderNumber: string) =>
        post<Order>(`/orders/${encodeURIComponent(orderNumber)}/cancel`),
      pay: (orderNumber: string, provider?: 'mock' | 'zarinpal') =>
        post<StartPayment>(
          `/orders/${encodeURIComponent(orderNumber)}/pay`,
          provider ? { provider } : {},
        ),
    },

    users: {
      updateProfile: (input: { fullName?: string; phone?: string; locale?: string }) =>
        patch<User>('/users/me', input),
      changePassword: (currentPassword: string, newPassword: string) =>
        post<{ success: true }>('/users/me/password', { currentPassword, newPassword }),
      addresses: () => get<Address[]>('/users/me/addresses'),
      createAddress: (input: AddressInput) => post<Address>('/users/me/addresses', input),
      updateAddress: (id: string, input: Partial<AddressInput>) =>
        patch<Address>(`/users/me/addresses/${id}`, input),
      deleteAddress: (id: string) => del<{ success: true }>(`/users/me/addresses/${id}`),
    },

    reviews: {
      create: (input: { productId: string; rating: number; title?: string; body: string }) =>
        post<Review>('/reviews', input),
      update: (id: string, input: { rating?: number; title?: string; body?: string }) =>
        patch<Review>(`/reviews/${id}`, input),
    },

    wishlist: {
      list: () => get<ProductCard[]>('/wishlist'),
      add: (productId: string) => post<{ success: true; added: boolean }>(`/wishlist/${productId}`),
      remove: (productId: string) =>
        del<{ success: true; removed: boolean }>(`/wishlist/${productId}`),
    },

    admin: {
      stats: () => get<AdminStats>('/admin/stats'),
      products: (query: { q?: string; page?: number; limit?: number } = {}) =>
        get<Paged<AdminProductRow>>('/admin/products', query as Record<string, QueryValue>),
      orders: (query: { status?: OrderStatus; page?: number; limit?: number } = {}) =>
        get<Paged<Order>>('/admin/orders', query as Record<string, QueryValue>),
      setOrderStatus: (orderId: string, status: OrderStatus) =>
        post<Order>(`/admin/orders/${orderId}/status`, { status }),
      cancelOrder: (orderId: string) => post<Order>(`/admin/orders/${orderId}/cancel`),
      reviews: (query: { status?: string; page?: number; limit?: number } = {}) =>
        get<Paged<Review>>('/admin/reviews', query as Record<string, QueryValue>),
      setReviewStatus: (id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') =>
        patch<Review>(`/admin/reviews/${id}/status`, { status }),
      setVariantStock: (productId: string, variantId: string, stock: number) =>
        patch<ProductDetail>(`/admin/products/${productId}/variants/${variantId}`, { stock }),
      updateProduct: (productId: string, input: Record<string, unknown>) =>
        patch<ProductDetail>(`/admin/products/${productId}`, input),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
