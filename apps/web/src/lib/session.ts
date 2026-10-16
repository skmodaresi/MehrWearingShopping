import { cookies } from 'next/headers';
import type { AuthResponse, User } from '@mehrwearing/api-client';

/**
 * The storefront keeps tokens in httpOnly cookies (the browser never sees
 * them) and forwards them to the API on every server-side request. This is
 * the BFF pattern: one origin for the app, zero CORS, XSS-safe storage.
 *
 * Cookie lifetimes mirror the API's JWT TTLs:
 *   access  → 15 minutes (rotated on refresh)
 *   refresh → 7 days     (rotated on refresh)
 *   user    → 7 days     (display only, never trusted for authz)
 */
export const COOKIES = {
  access: 'mws_access',
  refresh: 'mws_refresh',
  user: 'mws_user',
  cart: 'mws_cart',
} as const;

const ACCESS_MAX_AGE = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'CUSTOMER';
  locale: string;
}

function secureOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export async function setSession(auth: AuthResponse): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIES.access, auth.accessToken, { ...secureOptions(), maxAge: ACCESS_MAX_AGE });
  jar.set(COOKIES.refresh, auth.refreshToken, { ...secureOptions(), maxAge: REFRESH_MAX_AGE });
  jar.set(COOKIES.user, JSON.stringify(toSessionUser(auth.user)), {
    ...secureOptions(),
    httpOnly: false, // rendered in the header; harmless display data
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function setAccessAndRefresh(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIES.access, accessToken, { ...secureOptions(), maxAge: ACCESS_MAX_AGE });
  jar.set(COOKIES.refresh, refreshToken, { ...secureOptions(), maxAge: REFRESH_MAX_AGE });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  for (const name of Object.values(COOKIES)) {
    if (name === COOKIES.cart) continue; // keep the guest cart around
    jar.delete(name);
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIES.access)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIES.refresh)?.value;
}

/** Display-only user snapshot; authorization always happens on the API. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIES.user)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function getCartId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIES.cart)?.value;
}

export async function rememberCartId(cartId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIES.cart, cartId, { ...secureOptions(), httpOnly: false, maxAge: REFRESH_MAX_AGE });
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    locale: user.locale,
  };
}
