'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getCartAction } from '@/actions/cart';

/**
 * Client-side cart state. The cart itself lives on the API (guest carts are
 * identified by a cookie); this context only mirrors the badge count and
 * refreshes it after mutations.
 */
interface CartState {
  itemCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setCount: (count: number) => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { cart } = await getCartAction();
    if (cart) setItemCount(cart.itemCount);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCount = useCallback((count: number) => setItemCount(count), []);

  return (
    <CartContext.Provider value={{ itemCount, loading, refresh, setCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
