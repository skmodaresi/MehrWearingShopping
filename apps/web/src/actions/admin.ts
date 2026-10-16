'use server';

import { revalidatePath } from 'next/cache';
import { api, ServerApiError } from '@/lib/api';
import type { OrderStatus, ProductDetail, Review } from '@mehrwearing/api-client';

export interface AdminResult {
  ok?: boolean;
  error?: string;
}

function errorOf(error: unknown): AdminResult {
  if (error instanceof ServerApiError) return { error: error.code };
  return { error: 'GENERIC' };
}

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<AdminResult> {
  try {
    await api(`/admin/orders/${orderId}/status`, { method: 'POST', body: { status } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

export async function setReviewStatusAction(
  reviewId: string,
  status: 'APPROVED' | 'REJECTED',
): Promise<AdminResult> {
  try {
    await api<Review>(`/admin/reviews/${reviewId}/status`, { method: 'PATCH', body: { status } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

export async function updateVariantStockAction(
  productId: string,
  variantId: string,
  stock: number,
): Promise<AdminResult> {
  try {
    await api<ProductDetail>(`/admin/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      body: { stock: Math.max(0, Math.floor(stock)) },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

export async function updateProductAction(
  productId: string,
  input: { priceToman?: number; isFeatured?: boolean; status?: 'DRAFT' | 'ACTIVE' | 'HIDDEN' },
): Promise<AdminResult> {
  try {
    await api<ProductDetail>(`/admin/products/${productId}`, { method: 'PATCH', body: input });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}
