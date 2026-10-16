'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ServerApiError } from '@/lib/api';
import type { Address, ProductCard, Review, StartPayment, User } from '@mehrwearing/api-client';

export interface FormResult {
  ok?: boolean;
  error?: string;
  id?: string;
  added?: boolean;
}

function errorOf(error: unknown): FormResult {
  if (error instanceof ServerApiError) return { error: error.code };
  return { error: 'GENERIC' };
}

export async function saveAddressAction(formData: FormData): Promise<FormResult> {
  try {
    const address = await api<Address>('/users/me/addresses', {
      method: 'POST',
      body: {
        label: String(formData.get('label') ?? '') || undefined,
        recipientName: String(formData.get('recipientName') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        province: String(formData.get('province') ?? '').trim(),
        city: String(formData.get('city') ?? '').trim(),
        postalCode: String(formData.get('postalCode') ?? '').trim(),
        addressLine: String(formData.get('addressLine') ?? '').trim(),
        isDefault: formData.get('isDefault') === 'on',
      },
    });
    revalidatePath('/', 'layout');
    return { ok: true, id: address.id };
  } catch (error) {
    return errorOf(error);
  }
}

export async function deleteAddressAction(addressId: string): Promise<FormResult> {
  try {
    await api(`/users/me/addresses/${addressId}`, { method: 'DELETE' });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

export async function updateProfileAction(formData: FormData): Promise<FormResult> {
  try {
    await api<User>('/users/me', {
      method: 'PATCH',
      body: {
        fullName: String(formData.get('fullName') ?? '').trim(),
        ...(formData.get('phone') ? { phone: String(formData.get('phone')) } : {}),
      },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

export async function toggleWishlistAction(productId: string): Promise<FormResult> {
  try {
    // GET /wishlist returns a plain array of product cards.
    const listed = await api<ProductCard[]>('/wishlist');
    const exists = listed.some((item) => item.id === productId);
    const result = await api<{ added?: boolean; removed?: boolean }>(`/wishlist/${productId}`, {
      method: exists ? 'DELETE' : 'POST',
    });
    revalidatePath('/', 'layout');
    return { ok: true, added: exists ? false : (result.added ?? true) };
  } catch (error) {
    return errorOf(error);
  }
}

export async function createReviewAction(formData: FormData): Promise<FormResult> {
  try {
    const review = await api<Review>('/reviews', {
      method: 'POST',
      body: {
        productId: String(formData.get('productId') ?? ''),
        rating: Number(formData.get('rating') ?? 5),
        ...(formData.get('title') ? { title: String(formData.get('title')) } : {}),
        body: String(formData.get('body') ?? '').trim(),
      },
    });
    revalidatePath('/', 'layout');
    return { ok: true, id: review.id };
  } catch (error) {
    return errorOf(error);
  }
}

export async function cancelOrderAction(orderNumber: string, locale: string): Promise<FormResult> {
  try {
    await api(`/orders/${orderNumber}/cancel`, { method: 'POST', body: {} });
    revalidatePath(`/${locale}/order/${orderNumber}`);
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

/** Change password; the API revokes every refresh token afterwards. */
export async function changePasswordAction(formData: FormData): Promise<FormResult> {
  try {
    await api('/users/me/password', {
      method: 'POST',
      body: {
        currentPassword: String(formData.get('currentPassword') ?? ''),
        newPassword: String(formData.get('newPassword') ?? ''),
      },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return errorOf(error);
  }
}

/** Resume payment for an unpaid order (returns the gateway redirect URL). */
export async function payOrderAction(
  orderNumber: string,
): Promise<{ gatewayUrl?: string; error?: string }> {
  try {
    const payment = await api<StartPayment>(`/orders/${orderNumber}/pay`, {
      method: 'POST',
      body: {},
    });
    return { gatewayUrl: payment.gatewayUrl };
  } catch (error) {
    if (error instanceof ServerApiError) return { error: error.code };
    return { error: 'GENERIC' };
  }
}

/** Locale-aware redirect helper used by pages after mutations. */
export async function redirectToAccount(locale: string): Promise<never> {
  redirect(`/${locale}/account`);
}
