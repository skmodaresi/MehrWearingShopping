'use server';

import { api, ServerApiError } from '@/lib/api';
import type { CouponPreview, Order, StartPayment } from '@mehrwearing/api-client';

export interface CheckoutResult {
  ok?: boolean;
  gatewayUrl?: string;
  orderNumber?: string;
  error?: string;
}

/**
 * One server round-trip for the whole purchase:
 *   POST /orders (reserve stock + coupon) → POST /orders/:n/pay (gateway URL),
 * then the browser is redirected to the payment gateway, which redirects back
 * to the order page on success/cancel/failure.
 */
export async function checkoutAction(formData: FormData): Promise<CheckoutResult> {
  try {
    const order = await api<Order>('/orders', {
      method: 'POST',
      body: {
        addressId: String(formData.get('addressId') ?? ''),
        shippingMethod: formData.get('shippingMethod') === 'EXPRESS' ? 'EXPRESS' : 'STANDARD',
        ...(formData.get('couponCode') ? { couponCode: String(formData.get('couponCode')) } : {}),
        ...(formData.get('note') ? { note: String(formData.get('note')) } : {}),
      },
      locale: String(formData.get('locale') ?? 'fa-IR'),
    });

    const payment = await api<StartPayment>(`/orders/${order.orderNumber}/pay`, {
      method: 'POST',
      body: {},
    });
    return { ok: true, gatewayUrl: payment.gatewayUrl, orderNumber: order.orderNumber };
  } catch (error) {
    if (error instanceof ServerApiError) return { error: error.code };
    return { error: 'GENERIC' };
  }
}

/** Live coupon preview shown while typing the code in checkout/cart. */
export async function validateCouponAction(
  code: string,
  subtotalToman: number,
): Promise<{ preview?: CouponPreview; error?: string }> {
  try {
    const preview = await api<CouponPreview>('/coupons/validate', {
      method: 'POST',
      anonymous: true,
      body: { code, subtotalToman },
    });
    return { preview };
  } catch (error) {
    if (error instanceof ServerApiError) return { error: error.code };
    return { error: 'GENERIC' };
  }
}
