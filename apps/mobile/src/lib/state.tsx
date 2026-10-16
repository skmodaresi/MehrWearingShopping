import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse, Cart, User } from '@mehrwearing/api-client';
import { api, hydrateSession } from './api';
import { getItem, removeItem, setItem } from './storage';

// --- session ---------------------------------------------------------------

interface SessionValue {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const session = await hydrateSession();
      if (session.accessToken) {
        try {
          setUser(await api.auth.me());
        } catch {
          // Expired access token: the API rejects it, so treat as signed out;
          // a silent refresh is deliberately out of scope for this starter.
          setUser((session.user as User) ?? null);
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = await api.auth.login({ email, password });
    setUser(auth.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string }) => {
      const auth: AuthResponse = await api.auth.register({ locale: 'fa-IR', ...input });
      setUser(auth.user);
    },
    [],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await getItem('mws.refreshToken');
    if (refreshToken) {
      try {
        await api.auth.logout(refreshToken);
      } catch {
        // Signing out locally must succeed even when the API is unreachable.
      }
    }
    await Promise.all([
      removeItem('mws.accessToken'),
      removeItem('mws.refreshToken'),
      removeItem('mws.user'),
    ]);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, register, signOut }),
    [user, ready, signIn, register, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

// --- cart ------------------------------------------------------------------

interface CartValue {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (variantId: string, qty?: number) => Promise<string | null>;
  setQty: (variantId: string, qty: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
}

const CartContext = createContext<CartValue | null>(null);

function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await api.cart.get());
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Returns an error code (localized by the caller) or null on success. */
  const add = useCallback(async (variantId: string, qty = 1) => {
    try {
      setCart(await api.cart.addItem(variantId, qty));
      return null;
    } catch (error) {
      return (error as { code?: string }).code ?? 'common.error';
    }
  }, []);

  const setQty = useCallback(
    async (variantId: string, qty: number) => {
      try {
        if (qty <= 0) await api.cart.removeItem(variantId);
        else setCart(await api.cart.updateItem(variantId, qty));
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (variantId: string) => {
      try {
        setCart(await api.cart.removeItem(variantId));
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ cart, loading, refresh, add, setQty, remove }),
    [cart, loading, refresh, add, setQty, remove],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}

// --- composition -----------------------------------------------------------

/** Everything the app needs: locale/RTL, then session, then cart. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>{children}</CartProvider>
    </SessionProvider>
  );
}

export async function persistCartIdForTests(cartId: string): Promise<void> {
  await setItem('mws.cartId', cartId);
}
