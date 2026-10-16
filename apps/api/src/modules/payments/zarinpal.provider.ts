import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../common/config/env';
import { ApiException } from '../../common/http/api-exception';
import {
  CreatePaymentResult,
  PaymentOrderInput,
  PaymentProvider,
  VerifyInput,
  VerifyResult,
} from './payment-provider.interface';

const REQUEST_URL = 'https://payment.zarinpal.com/pg/v4/payment/request.json';
const VERIFY_URL = 'https://payment.zarinpal.com/pg/v4/payment/verify.json';
const START_PAY_URL = 'https://payment.zarinpal.com/pg/StartPay/';

/**
 * Zarinpal v4 (official docs: https://www.zarinpal.com/docs/paymentGateway).
 *
 * Flow: request → authority → redirect user to StartPay → callback with
 * Authority+Status → server-side verify. The order is only marked PAID after
 * a successful verify — never on the browser callback alone.
 *
 * Amounts are sent in Toman with `currency: 'IRT'`, matching how the catalog
 * prices everything.
 */
@Injectable()
export class ZarinpalPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(ZarinpalPaymentProvider.name);
  readonly name = 'ZARINPAL' as const;

  async createPayment(order: PaymentOrderInput): Promise<CreatePaymentResult> {
    const merchantId = env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) {
      throw ApiException.badRequest(
        'PAYMENT_NOT_CONFIGURED',
        'Zarinpal is selected but ZARINPAL_MERCHANT_ID is empty',
      );
    }

    const response = await fetch(REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: order.totalToman,
        currency: 'IRT',
        callback_url: env.ZARINPAL_CALLBACK_URL,
        description: order.description,
      }),
    });
    const payload = (await response.json()) as {
      data?: { code?: number; authority?: string; message?: string };
      errors?: unknown;
    };
    const authority = payload.data?.authority;
    if (payload.data?.code !== 100 || !authority) {
      this.logger.error(`Zarinpal request failed: ${JSON.stringify(payload)}`);
      throw ApiException.badRequest(
        'GATEWAY_ERROR',
        `Zarinpal did not return an authority (code ${payload.data?.code ?? 'unknown'})`,
        { response: payload.data ?? payload.errors ?? null },
      );
    }

    return { gatewayUrl: `${START_PAY_URL}${authority}`, authority };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const merchantId = env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'ZARINPAL_MERCHANT_ID is empty' };
    }

    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount: input.amountToman,
          currency: 'IRT',
          authority: input.authority,
        }),
      });
      const payload = (await response.json()) as {
        data?: { code?: number; ref_id?: number; card_hash?: string; message?: string };
        errors?: unknown;
      };
      const code = payload.data?.code;
      // 100 = verified, 101 = already verified (idempotent success)
      if (code === 100 || code === 101) {
        return {
          ok: true,
          code: String(code),
          transactionId: payload.data?.ref_id ? String(payload.data.ref_id) : undefined,
          raw: JSON.stringify(payload),
        };
      }
      return {
        ok: false,
        code: code !== undefined ? String(code) : 'UNKNOWN',
        message: payload.data?.message ?? 'Verification failed',
        raw: JSON.stringify(payload),
      };
    } catch (error) {
      this.logger.error(`Zarinpal verify error: ${String(error)}`);
      return { ok: false, code: 'NETWORK_ERROR', message: 'Could not reach Zarinpal' };
    }
  }
}
