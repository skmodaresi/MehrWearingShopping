import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentProviderType } from '../../generated/prisma/client';
import { env } from '../../common/config/env';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { MockPaymentProvider, mockSignature } from './mock.provider';
import { PaymentProvider } from './payment-provider.interface';
import { ZarinpalPaymentProvider } from './zarinpal.provider';

export interface StartPaymentResult {
  orderNumber: string;
  provider: PaymentProviderType;
  gatewayUrl: string;
  authority: string | null;
  amountToman: number;
}

interface PaidOrderContext {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
}

/**
 * Orchestrates payments:
 *  - createPayment() issues a gateway redirect and persists a NOT_PAID row;
 *  - gateway callbacks are verified server-side and only then does the order
 *    become PAID (idempotent, transactional);
 *  - failures leave the order PENDING so the customer can retry.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MockPaymentProvider) private readonly mock: MockPaymentProvider,
    @Inject(ZarinpalPaymentProvider) private readonly zarinpal: ZarinpalPaymentProvider,
  ) {}

  private provider(requested?: 'mock' | 'zarinpal'): PaymentProvider {
    const wanted = requested ?? env.PAYMENT_PROVIDER;
    return wanted === 'zarinpal' ? this.zarinpal : this.mock;
  }

  async createPayment(
    viewer: JwtPayload,
    orderNumber: string,
    requested?: 'mock' | 'zarinpal',
  ): Promise<StartPaymentResult> {
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order || (order.userId !== viewer.sub && viewer.role !== 'ADMIN')) {
      throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    }
    if (order.paymentStatus === 'PAID') {
      throw ApiException.badRequest('ALREADY_PAID', 'Order is already paid');
    }
    if (order.status !== 'PENDING') {
      throw ApiException.badRequest('ORDER_NOT_PAYABLE', `A ${order.status} order cannot be paid`);
    }

    const provider = this.provider(requested);
    const result = await provider.createPayment({
      id: order.id,
      orderNumber: order.orderNumber,
      totalToman: order.totalToman,
      locale: order.locale,
      description: `MehrWearingShopping #${order.orderNumber}`,
    });

    const existing = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: 'NOT_PAID' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          provider: provider.name,
          amountToman: order.totalToman,
          authority: result.authority ?? null,
        },
      });
    } else {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: provider.name,
          amountToman: order.totalToman,
          authority: result.authority ?? null,
        },
      });
    }

    return {
      orderNumber: order.orderNumber,
      provider: provider.name,
      gatewayUrl: result.gatewayUrl,
      authority: result.authority ?? null,
      amountToman: order.totalToman,
    };
  }

  // -------------------------------------------------------------------------
  // Mock gateway (development / demos)
  // -------------------------------------------------------------------------

  async mockGatewayPage(
    orderNumber: string,
    amountToman: number,
    signature: string,
  ): Promise<string> {
    const order = await this.assertSignedMock(orderNumber, amountToman, signature);
    return renderMockGatewayPage(order.orderNumber, order.totalToman, signature);
  }

  async handleMockCallback(input: {
    orderNumber: string;
    amountToman: number;
    signature: string;
    result?: string;
  }): Promise<string> {
    const order = await this.assertSignedMock(
      input.orderNumber,
      input.amountToman,
      input.signature,
    );

    if (input.result !== 'success') {
      await this.markFailed(order.id);
      return this.redirect(order, 'cancelled');
    }

    const verify = await this.mock.verify({
      authority: `MOCK-${order.orderNumber}`,
      amountToman: order.totalToman,
      signature: input.signature,
    });
    if (!verify.ok) {
      await this.markFailed(order.id);
      return this.redirect(order, 'failed');
    }

    await this.markPaid(order, {
      provider: 'MOCK',
      authority: `MOCK-${order.orderNumber}`,
      transactionId: verify.transactionId ?? null,
      raw: JSON.stringify({ mock: true, at: new Date().toISOString() }),
    });
    return this.redirect(order, 'success');
  }

  private async assertSignedMock(orderNumber: string, amountToman: number, signature: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order) throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    if (order.totalToman !== amountToman) {
      throw ApiException.badRequest('AMOUNT_MISMATCH', 'Gateway amount does not match the order');
    }
    if (signature !== mockSignature(orderNumber, amountToman)) {
      throw ApiException.badRequest('INVALID_SIGNATURE', 'Invalid mock gateway signature');
    }
    return order;
  }

  // -------------------------------------------------------------------------
  // Zarinpal callback
  // -------------------------------------------------------------------------

  async handleZarinpalCallback(authority: string, status?: string): Promise<string> {
    const payment = await this.prisma.payment.findFirst({
      where: { authority },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw ApiException.badRequest('UNKNOWN_AUTHORITY', 'Unknown payment authority');
    const order = payment.order;

    if (status !== 'OK') {
      await this.markFailed(order.id);
      return this.redirect(order, 'failed');
    }
    if (order.paymentStatus === 'PAID') return this.redirect(order, 'success'); // idempotent retry

    const verify = await this.zarinpal.verify({ authority, amountToman: payment.amountToman });
    if (!verify.ok) {
      this.logger.warn(
        `Zarinpal verify failed for ${order.orderNumber}: ${verify.code} ${verify.message ?? ''}`,
      );
      await this.markFailed(order.id);
      return this.redirect(order, 'failed');
    }

    await this.markPaid(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
      {
        provider: 'ZARINPAL',
        authority,
        transactionId: verify.transactionId ?? null,
        raw: verify.raw ?? null,
      },
    );
    return this.redirect(order, 'success');
  }

  // -------------------------------------------------------------------------

  private redirect(order: { orderNumber: string; locale: string }, result: string): string {
    return `${env.WEB_BASE_URL}/${order.locale}/order/${order.orderNumber}?payment=${result}`;
  }

  private async markFailed(orderId: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { orderId, status: 'NOT_PAID' },
      data: { status: 'FAILED' },
    });
  }

  /** Marks the order PAID exactly once and bumps product sales counters. */
  private async markPaid(
    order: PaidOrderContext,
    data: {
      provider: PaymentProviderType;
      authority: string;
      transactionId: string | null;
      raw: string | null;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      if (fresh.paymentStatus === 'PAID') return;
      if (fresh.status === 'CANCELLED' || fresh.status === 'REFUNDED') {
        throw ApiException.badRequest('ORDER_CANCELLED', 'Order was cancelled; payment rejected');
      }

      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paymentStatus: 'PAID', paidAt: now },
      });
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'NOT_PAID' },
        data: {
          status: 'PAID',
          paidAt: now,
          authority: data.authority,
          transactionId: data.transactionId,
          rawPayload: data.raw,
        },
      });
      for (const item of fresh.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: item.qty } },
        });
      }
    });
    this.logger.log(`Order ${order.orderNumber} marked PAID via ${data.provider}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Simple bilingual gateway page rendered by the API (no frontend needed). */
function renderMockGatewayPage(
  orderNumber: string,
  amountToman: number,
  signature: string,
): string {
  const amountFa = new Intl.NumberFormat('fa-IR').format(amountToman);
  const amountEn = new Intl.NumberFormat('en-US').format(amountToman);
  const base = `${env.API_BASE_URL}/api/v1/payments/mock/callback?order=${encodeURIComponent(
    orderNumber,
  )}&amount=${amountToman}&sig=${encodeURIComponent(signature)}`;
  const success = `${base}&result=success`;
  const cancel = `${base}&result=cancel`;

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MehrWearing — درگاه پرداخت آزمایشی</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Vazirmatn, Tahoma, system-ui, sans-serif; background: #f1f5f9; display: grid; place-items: center; min-height: 100vh; }
  .card { background: #fff; width: min(440px, 92vw); border-radius: 16px; box-shadow: 0 10px 40px rgba(15,23,42,.12); overflow: hidden; }
  header { background: linear-gradient(135deg, #0f172a, #1d4ed8); color: #fff; padding: 20px 24px; }
  header h1 { margin: 0; font-size: 18px; }
  header p { margin: 6px 0 0; font-size: 12px; opacity: .85; }
  main { padding: 24px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
  .row b { font-weight: 700; }
  .amount { font-size: 26px; font-weight: 800; color: #0f172a; margin: 18px 0 4px; text-align: center; }
  .amount small { font-size: 14px; font-weight: 600; color: #64748b; }
  .actions { display: grid; gap: 10px; margin-top: 22px; }
  a.btn { display: block; text-align: center; padding: 13px 16px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; }
  .pay { background: #16a34a; color: #fff; }
  .pay:hover { background: #15803d; }
  .cancel { background: #fff; color: #b91c1c; border: 1px solid #fecaca; }
  footer { padding: 14px 24px 22px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.7; }
  bdi { direction: ltr; unicode-bidi: isolate; }
</style>
</head>
<body>
  <div class="card">
    <header>
      <h1>درگاه پرداخت آزمایشی مهرویر</h1>
      <p>MehrWearingShopping test gateway — no real money moves</p>
    </header>
    <main>
      <div class="row"><span>شماره سفارش / Order</span><b><bdi>${escapeHtml(orderNumber)}</bdi></b></div>
      <div class="row"><span>مبلغ / Amount</span><b><bdi>${amountEn} Toman</bdi></b></div>
      <div class="amount">${amountFa} <small>تومان</small></div>
      <div class="actions">
        <a class="btn pay" href="${success}">پرداخت موفق &nbsp;·&nbsp; Simulate successful payment</a>
        <a class="btn cancel" href="${cancel}">انصراف از پرداخت &nbsp;·&nbsp; Cancel payment</a>
      </div>
    </main>
    <footer>
      این درگاه فقط در حالت توسعه (PAYMENT_PROVIDER=mock) فعال است.<br />
      Production uses Zarinpal with server-side verification.
    </footer>
  </div>
</body>
</html>`;
}
