/**
 * Payment provider abstraction.
 *
 * Two implementations ship with the project:
 *  - MockPaymentProvider       built-in fake gateway (development & demos)
 *  - ZarinpalPaymentProvider   Iranian production gateway (request → StartPay → verify)
 *
 * Adding Stripe/PayPal/etc. means implementing this interface and registering
 * it in PaymentsService — the order state machine does not change.
 */

export interface PaymentOrderInput {
  id: string;
  orderNumber: string;
  totalToman: number;
  locale: string;
  description: string;
}

export interface CreatePaymentResult {
  gatewayUrl: string;
  authority?: string;
}

export interface VerifyInput {
  authority: string;
  amountToman: number;
  /** Mock provider only: signature issued together with the gateway link. */
  signature?: string;
}

export interface VerifyResult {
  ok: boolean;
  transactionId?: string;
  code?: string;
  message?: string;
  raw?: string;
}

export interface PaymentProvider {
  readonly name: 'MOCK' | 'ZARINPAL';
  createPayment(order: PaymentOrderInput): Promise<CreatePaymentResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}
