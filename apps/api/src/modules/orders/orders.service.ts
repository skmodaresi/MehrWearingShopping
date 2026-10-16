import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Order, OrderStatus, PaymentStatus, ShippingMethod } from '../../generated/prisma/client';
import { env } from '../../common/config/env';
import { ApiException } from '../../common/http/api-exception';
import { paged, Paged, parsePagination } from '../../common/utils/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { computeTotals, PricingConfig } from './pricing';
import { PlaceOrderDto } from './dto';

export interface OrderItemDto {
  id: string;
  variantId: string | null;
  productId: string;
  productNameFa: string;
  productNameEn: string;
  variantLabel: string | null;
  imageUrl: string | null;
  sku: string;
  unitPriceToman: number;
  qty: number;
  lineTotalToman: number;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  locale: string;
  subtotalToman: number;
  discountToman: number;
  shippingCostToman: number;
  totalToman: number;
  couponCode: string | null;
  shippingMethod: ShippingMethod;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  note: string | null;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItemDto[];
  timeline: Array<{ status: OrderStatus; at: string }>;
  customer?: { id: string; email: string; fullName: string };
}

type OrderWithItems = Order & {
  items: Array<{
    id: string;
    variantId: string | null;
    productId: string;
    productNameFa: string;
    productNameEn: string;
    variantLabel: string | null;
    imageUrl: string | null;
    sku: string;
    unitPriceToman: number;
    qty: number;
    lineTotalToman: number;
  }>;
  user?: { id: string; email: string; fullName: string };
};

/**
 * Allowed order transitions. Everything else is rejected — this is the single
 * source of truth for the order state machine (web admin UI mirrors it).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses at which stock has been reserved and can be restored. */
const RESTOCKABLE: OrderStatus[] = ['PENDING', 'PAID', 'PROCESSING'];

export function toOrderDto(order: OrderWithItems): OrderDto {
  const timeline: Array<{ status: OrderStatus; at: string }> = [
    { status: 'PENDING', at: order.placedAt.toISOString() },
  ];
  if (order.paidAt) timeline.push({ status: 'PAID', at: order.paidAt.toISOString() });
  if (order.shippedAt) timeline.push({ status: 'SHIPPED', at: order.shippedAt.toISOString() });
  if (order.deliveredAt)
    timeline.push({ status: 'DELIVERED', at: order.deliveredAt.toISOString() });
  if (order.cancelledAt) {
    timeline.push({
      status: order.status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED',
      at: order.cancelledAt.toISOString(),
    });
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    locale: order.locale,
    subtotalToman: order.subtotalToman,
    discountToman: order.discountToman,
    shippingCostToman: order.shippingCostToman,
    totalToman: order.totalToman,
    couponCode: order.couponCode,
    shippingMethod: order.shippingMethod,
    recipientName: order.recipientName,
    phone: order.phone,
    province: order.province,
    city: order.city,
    postalCode: order.postalCode,
    addressLine: order.addressLine,
    note: order.note,
    placedAt: order.placedAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    items: order.items,
    timeline,
    ...(order.user ? { customer: order.user } : {}),
  };
}

@Injectable()
export class OrdersService {
  private readonly pricing: PricingConfig = {
    standardCost: env.SHIPPING_STANDARD_COST,
    expressCost: env.SHIPPING_EXPRESS_COST,
    freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
  ) {}

  // -------------------------------------------------------------------------
  // Checkout
  // -------------------------------------------------------------------------

  async place(userId: string, dto: PlaceOrderDto, locale: string): Promise<OrderDto> {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart || cart.items.length === 0) {
      throw ApiException.badRequest('CART_EMPTY', 'Add items to the cart before checking out');
    }

    const address = await this.prisma.address.findUnique({ where: { id: dto.addressId } });
    if (!address || address.userId !== userId) {
      throw ApiException.notFound('ADDRESS_NOT_FOUND', 'Address not found');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: cart.items.map((item) => item.variantId) } },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            nameFa: true,
            nameEn: true,
            status: true,
            priceToman: true,
            images: { orderBy: { position: 'asc' }, take: 1 },
          },
        },
      },
    });
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    const lines: Array<{ variantId: string; qty: number; unitPriceToman: number }> = [];
    for (const item of cart.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant || variant.product.status !== 'ACTIVE') {
        throw ApiException.conflict(
          'PRODUCT_UNAVAILABLE',
          'A product in your cart is no longer available',
          {
            variantId: item.variantId,
          },
        );
      }
      if (item.qty > variant.stock) {
        throw ApiException.conflict('OUT_OF_STOCK', 'Not enough stock for the requested quantity', {
          variantId: variant.id,
          sku: variant.sku,
          available: variant.stock,
          requested: item.qty,
        });
      }
      lines.push({
        variantId: variant.id,
        qty: item.qty,
        unitPriceToman: variant.priceToman ?? variant.product.priceToman,
      });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.unitPriceToman * line.qty, 0);
    const coupon = dto.couponCode ? await this.coupons.validate(dto.couponCode, subtotal) : null;

    const shippingMethod: ShippingMethod =
      dto.shippingMethod === 'EXPRESS' ? 'EXPRESS' : 'STANDARD';
    const totals = computeTotals(lines, { coupon, shippingMethod, config: this.pricing });

    const orderNumber = generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Reserve stock atomically — updateMany with a guard aborts oversells.
      for (const line of lines) {
        const reserved = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.qty } },
          data: { stock: { decrement: line.qty } },
        });
        if (reserved.count === 0) {
          const current = await tx.productVariant.findUnique({ where: { id: line.variantId } });
          throw ApiException.conflict('OUT_OF_STOCK', 'Stock changed while checking out', {
            variantId: line.variantId,
            available: current?.stock ?? 0,
            requested: line.qty,
          });
        }
        await tx.inventoryMovement.create({
          data: { variantId: line.variantId, delta: -line.qty, reason: 'ORDER', userId },
        });
      }

      // 2. Claim a coupon slot (optimistic: only if nothing else took it).
      if (coupon) {
        const claimed = await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: coupon.usedCount },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw ApiException.badRequest('COUPON_EXHAUSTED', 'Coupon usage limit reached');
        }
      }

      // 3. Persist the order with a full snapshot (prices, address, items).
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          locale,
          shippingMethod,
          subtotalToman: totals.subtotalToman,
          discountToman: totals.discountToman,
          shippingCostToman: totals.shippingCostToman,
          totalToman: totals.totalToman,
          couponCode: coupon?.code ?? null,
          note: dto.note ?? null,
          recipientName: address.recipientName,
          phone: address.phone,
          province: address.province,
          city: address.city,
          postalCode: address.postalCode,
          addressLine: address.addressLine,
        },
        include: { items: true },
      });

      await tx.orderItem.createMany({
        data: lines.map((line) => {
          const variant = variantMap.get(line.variantId)!;
          const label = [variant.size, variant.color].filter(Boolean).join(' / ') || null;
          return {
            orderId: created.id,
            variantId: variant.id,
            productId: variant.product.id,
            productNameFa: variant.product.nameFa,
            productNameEn: variant.product.nameEn,
            variantLabel: label,
            imageUrl: variant.product.images[0]?.url ?? null,
            sku: variant.sku,
            unitPriceToman: line.unitPriceToman,
            qty: line.qty,
            lineTotalToman: line.unitPriceToman * line.qty,
          };
        }),
      });

      // 4. Clear the cart.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } });
    });

    return toOrderDto(order);
  }

  // -------------------------------------------------------------------------
  // Customer-facing
  // -------------------------------------------------------------------------

  async listMine(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<Paged<OrderDto>> {
    const params = parsePagination(query);
    const where = { userId };
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { items: true },
      }),
    ]);
    return paged(orders.map(toOrderDto), total, params);
  }

  async getOne(
    orderNumber: string,
    viewer: { sub: string; role: 'ADMIN' | 'CUSTOMER' },
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, user: { select: { id: true, email: true, fullName: true } } },
    });
    if (!order) throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    if (order.userId !== viewer.sub && viewer.role !== 'ADMIN') {
      throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    }
    return toOrderDto(order);
  }

  async cancel(
    orderNumber: string,
    viewer: { sub: string; role: 'ADMIN' | 'CUSTOMER' },
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    if (order.userId !== viewer.sub && viewer.role !== 'ADMIN') {
      throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    }
    if (viewer.role !== 'ADMIN' && order.status !== 'PENDING') {
      throw ApiException.badRequest(
        'ORDER_NOT_CANCELLABLE',
        'Only unpaid orders can be cancelled by the customer',
      );
    }
    if (!ORDER_TRANSITIONS[order.status].includes('CANCELLED')) {
      throw ApiException.badRequest(
        'ORDER_NOT_CANCELLABLE',
        `Cannot cancel a ${order.status} order`,
      );
    }
    return this.transition(order.id, 'CANCELLED');
  }

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  async listAll(query: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }): Promise<Paged<OrderDto>> {
    const params = parsePagination(query);
    const where = query.status ? { status: query.status } : {};
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { items: true, user: { select: { id: true, email: true, fullName: true } } },
      }),
    ]);
    return paged(orders.map(toOrderDto), total, params);
  }

  async setStatus(orderId: string, status: OrderStatus): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');
    if (!ORDER_TRANSITIONS[order.status].includes(status)) {
      throw ApiException.badRequest(
        'INVALID_TRANSITION',
        `Order cannot move from ${order.status} to ${status}`,
        { allowed: ORDER_TRANSITIONS[order.status] },
      );
    }
    return this.transition(orderId, status);
  }

  // -------------------------------------------------------------------------

  /** Applies a transition with stock/coupon side effects inside one transaction. */
  private async transition(orderId: string, status: OrderStatus): Promise<OrderDto> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw ApiException.notFound('ORDER_NOT_FOUND', 'Order not found');

      const restock =
        (status === 'CANCELLED' || status === 'REFUNDED') && RESTOCKABLE.includes(order.status);

      if (restock) {
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              delta: item.qty,
              reason: 'CANCEL',
              orderId: order.id,
            },
          });
        }
        if (order.couponCode) {
          await tx.coupon.updateMany({
            where: { code: order.couponCode, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          ...(status === 'SHIPPED' ? { shippedAt: now } : {}),
          ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
          ...(status === 'CANCELLED' || status === 'REFUNDED' ? { cancelledAt: now } : {}),
          ...(status === 'REFUNDED' && order.paymentStatus === 'PAID'
            ? { paymentStatus: 'REFUNDED' as const }
            : {}),
        },
        include: { items: true, user: { select: { id: true, email: true, fullName: true } } },
      });
      return toOrderDto(updated);
    });
  }
}

function generateOrderNumber(): string {
  // MW-<12 hex> — readable, unique enough, and traceable in support chats.
  return `MW-${randomBytes(6).toString('hex').toUpperCase()}`;
}
