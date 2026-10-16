import { createApiClient } from '@mehrwearing/api-client';
import { getItem, setItem } from './storage';

/**
 * Single API client instance for the app.
 *
 * `@mehrwearing/api-client` is the exact same package the web storefront and
 * any desktop client use — it is pure `fetch`, so it runs unchanged in React
 * Native. Tokens and the guest cart id are persisted through `storage`.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

const KEYS = {
  access: 'mws.accessToken',
  refresh: 'mws.refreshToken',
  user: 'mws.user',
  cart: 'mws.cartId',
  locale: 'mws.locale',
} as const;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let cartId: string | null = null;

/** Mutable so the i18n layer can flip `x-locale` when the user switches. */
export const defaultHeaders: Record<string, string> = { 'x-locale': 'fa-IR' };

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => accessToken,
  getCartId: () => cartId,
  defaultHeaders,
  onTokens: (tokens) => {
    accessToken = tokens?.accessToken ?? null;
    refreshToken = tokens?.refreshToken ?? null;
    void setItem(KEYS.access, accessToken ?? '');
    void setItem(KEYS.refresh, refreshToken ?? '');
    void setItem(KEYS.user, tokens ? JSON.stringify(tokens.user) : '');
  },
  onCartId: (id) => {
    cartId = id;
    void setItem(KEYS.cart, id);
  },
});

/** Restores the persisted session + cart id once at cold start. */
export async function hydrateSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  cartId: string | null;
  user: unknown | null;
}> {
  const [access, refresh, cart, user] = await Promise.all([
    getItem(KEYS.access),
    getItem(KEYS.refresh),
    getItem(KEYS.cart),
    getItem(KEYS.user),
  ]);
  accessToken = access || null;
  refreshToken = refresh || null;
  cartId = cart || null;
  let parsedUser: unknown = null;
  try {
    parsedUser = user ? JSON.parse(user) : null;
  } catch {
    parsedUser = null;
  }
  return { accessToken, refreshToken, cartId, user: parsedUser };
}

export function setStoredLocale(locale: string): void {
  defaultHeaders['x-locale'] = locale;
  void setItem(KEYS.locale, locale);
}

export function getStoredLocaleKey(): string {
  return KEYS.locale;
}

/**
 * Absolute URL for a catalog asset. The API returns root-relative paths
 * (`/images/products/x.svg`); mobile has no shared origin with the API, so
 * they are resolved against the API origin (not the `/api/v1` prefix).
 */
export function assetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export { getItem as readStored };
