'use server';

import { revalidatePath } from 'next/cache';
import { api, ServerApiError } from '@/lib/api';
import type { Cart } from '@mehrwearing/api-client';

export interface CartResult {
  cart?: Cart;
  error?: string;
}

function toResult(error: unknown): CartResult {
  if (error instanceof ServerApiError) return { error: error.code };
  return { error: 'GENERIC' };
}

/** Reads the caller's cart (creates a guest cart on first call). */
export async function getCartAction(): Promise<CartResult> {
  try {
    const cart = await api<Cart>('/cart');
    return { cart };
  } catch (error) {
    return toResult(error);
  }
}

export async function addToCartAction(variantId: string, qty = 1): Promise<CartResult> {
  try {
    const cart = await api<Cart>('/cart/items', { method: 'POST', body: { variantId, qty } });
    revalidatePath('/', 'layout');
    return { cart };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateCartAction(variantId: string, qty: number): Promise<CartResult> {
  try {
    const cart = await api<Cart>(`/cart/items/${variantId}`, { method: 'PATCH', body: { qty } });
    revalidatePath('/', 'layout');
    return { cart };
  } catch (error) {
    return toResult(error);
  }
}

export async function removeFromCartAction(variantId: string): Promise<CartResult> {
  try {
    const cart = await api<Cart>(`/cart/items/${variantId}`, { method: 'DELETE' });
    revalidatePath('/', 'layout');
    return { cart };
  } catch (error) {
    return toResult(error);
  }
}
