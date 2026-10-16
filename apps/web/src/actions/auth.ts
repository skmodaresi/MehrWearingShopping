'use server';

import { redirect } from 'next/navigation';
import { api, refreshSession, ServerApiError } from '@/lib/api';
import { clearSession, setSession } from '@/lib/session';
import type { AuthResponse } from '@mehrwearing/api-client';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

function errorState(error: unknown): ActionState {
  if (error instanceof ServerApiError) return { error: error.code };
  return { error: 'GENERIC' };
}

/** POST /auth/login → persist httpOnly session cookies, then continue. */
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const auth = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: {
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
      },
    });
    await setSession(auth);
    return { ok: true };
  } catch (error) {
    return errorState(error);
  }
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const phone = String(formData.get('phone') ?? '').trim();
  try {
    const auth = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      anonymous: true,
      body: {
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
        fullName: String(formData.get('fullName') ?? '').trim(),
        ...(phone ? { phone } : {}),
        locale: String(formData.get('locale') ?? 'fa-IR'),
      },
    });
    await setSession(auth);
    return { ok: true };
  } catch (error) {
    return errorState(error);
  }
}

export async function logoutAction(): Promise<void> {
  const { getRefreshToken } = await import('@/lib/session');
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await api('/auth/logout', { method: 'POST', anonymous: true, body: { refreshToken } });
    } catch {
      // Logging out locally must succeed even if the API is unreachable.
    }
  }
  await clearSession();
}

/**
 * Called by the client when a page comes back unauthorized but a refresh
 * cookie still exists — rotates tokens and reloads the view.
 */
export async function refreshSessionAction(): Promise<{ refreshed: boolean }> {
  const refreshed = await refreshSession();
  return { refreshed };
}

/** Sign-in/register pages land here after a successful action. */
export async function redirectToAfterAuth(locale: string, target?: string): Promise<never> {
  const safe = target && target.startsWith('/') ? target : `/${locale}/account`;
  redirect(safe);
}
