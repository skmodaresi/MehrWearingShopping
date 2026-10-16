import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../../common/config/env';
import {
  CreatePaymentResult,
  PaymentOrderInput,
  PaymentProvider,
  VerifyInput,
  VerifyResult,
} from './payment-provider.interface';

/**
 * Signature for mock-gateway links. Ties an `order+amount` pair to a link the
 * API itself issued, so a hand-crafted callback cannot mark an arbitrary order
 * paid. Development-only: production uses Zarinpal's server-side verify.
 */
export function mockSignature(orderNumber: string, amountToman: number): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${orderNumber}:${amountToman}`)
    .digest('hex');
}

export function mockGatewayUrl(orderNumber: string, amountToman: number): string {
  const signature = mockSignature(orderNumber, amountToman);
  const params = new URLSearchParams({
    order: orderNumber,
    amount: String(amountToman),
    sig: signature,
  });
  return `${env.API_BASE_URL}/api/v1/payments/mock/checkout?${params.toString()}`;
}

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;

  createPayment(order: PaymentOrderInput): Promise<CreatePaymentResult> {
    return Promise.resolve({
      gatewayUrl: mockGatewayUrl(order.orderNumber, order.totalToman),
      authority: `MOCK-${order.orderNumber}`,
    });
  }

  verify(input: VerifyInput): Promise<VerifyResult> {
    const expected = mockSignature(input.authority.replace(/^MOCK-/, ''), input.amountToman);
    const ok = input.signature === expected;
    return Promise.resolve(
      ok
        ? {
            ok: true,
            transactionId: `MOCKTX-${randomBytes(6).toString('hex').toUpperCase()}`,
            code: '100',
          }
        : { ok: false, code: 'SIGNATURE_MISMATCH', message: 'Mock gateway signature mismatch' },
    );
  }
}
