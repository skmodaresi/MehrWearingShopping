import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  getAccessToken,
  getCartId,
  getRefreshToken,
  rememberCartId,
  setAccessAndRefresh,
} from './session';

const API_BASE = (process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

/** Normalized server-side API failure (mirrors the API error envelope). */
export class ServerApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ServerApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip Authorization (public endpoints). */
  anonymous?: boolean;
  /** Locale forwarded to the API so orders record the shopper's language. */
  locale?: string;
}

/**
 * Single funnel for server → API traffic (RSCs and server actions).
 * Attaches Bearer token + guest cart id, normalizes errors, and persists a
 * newly issued cart id so the guest cart survives reloads.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const requestHeaders: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  if (!options.anonymous) {
    const token = await getAccessToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  const cartId = await getCartId();
  if (cartId) requestHeaders['x-cart-id'] = cartId;

  const requestLocale = options.locale ?? (await headers()).get('x-locale');
  if (requestLocale) requestHeaders['x-locale'] = requestLocale;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: requestHeaders,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  // Guest carts: the API echoes its id — remember it for the next request.
  // Next only allows cookie writes inside server actions/route handlers, so a
  // page render that *creates* the first guest cart cannot persist the id here;
  // `CartProvider` calls `getCartAction()` (a server action) on mount, which
  // stores it a moment later. Never let that timing detail break a render.
  const issuedCartId = response.headers.get('x-cart-id');
  if (issuedCartId) await rememberCartIdQuietly(issuedCartId);
  const cartIdFromBody = (payload as { cartId?: string } | null)?.cartId;
  if (cartIdFromBody) await rememberCartIdQuietly(cartIdFromBody);

  if (!response.ok) {
    const envelope = (payload ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new ServerApiError(
      response.status,
      envelope.code ?? 'GENERIC',
      envelope.message ?? `API error ${response.status}`,
      envelope.details,
    );
  }
  return payload as T;
}

/** Like {@link api}, but converts 404s into Next's not-found page. */
export async function apiOr404<T>(path: string, options: ApiOptions = {}): Promise<T> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) notFound();
    throw error;
  }
}

async function rememberCartIdQuietly(cartId: string): Promise<void> {
  try {
    await rememberCartId(cartId);
  } catch (error) {
    // Read-only render context: the client bootstrap action persists it.
    console.warn('[web] cart id deferred to client bootstrap', error);
  }
}

/**
 * Rotates the refresh token (server action only — writes cookies).
 * Returns false when the refresh cookie is missing or rejected.
 */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const auth = (await response.json()) as { accessToken: string; refreshToken: string };
    await setAccessAndRefresh(auth.accessToken, auth.refreshToken);
    return true;
  } catch {
    return false;
  }
}
