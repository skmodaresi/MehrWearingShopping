import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const LOW_STOCK_THRESHOLD = 5;

/** Admin dashboard aggregates — all read-only, safe to hit on every render. */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      today,
      month,
      allTime,
      ordersByStatus,
      totalOrders,
      customers,
      products,
      lowStock,
      topProducts,
      recentOrders,
    ] = await Promise.all([
      revenue(this.prisma, startOfDay),
      revenue(this.prisma, startOfMonth),
      revenue(this.prisma, null),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.count(),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.productVariant.findMany({
        where: { stock: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stock: 'asc' },
        take: 10,
        select: {
          sku: true,
          stock: true,
          size: true,
          color: true,
          product: { select: { slug: true, nameFa: true, nameEn: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { salesCount: 'desc' },
        take: 5,
        select: {
          slug: true,
          nameFa: true,
          nameEn: true,
          salesCount: true,
          priceToman: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        },
      }),
      this.prisma.order.findMany({
        orderBy: { placedAt: 'desc' },
        take: 5,
        select: {
          orderNumber: true,
          status: true,
          totalToman: true,
          placedAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const byStatus = Object.fromEntries(
      ordersByStatus.map((row) => [row.status, row._count._all]),
    ) as Record<OrderStatus, number>;

    return {
      revenue: {
        todayToman: today.sum,
        monthToman: month.sum,
        allTimeToman: allTime.sum,
        paidOrders: allTime.count,
      },
      orders: { total: totalOrders, byStatus },
      customers,
      products,
      lowStock,
      topProducts: topProducts.map((product) => ({
        slug: product.slug,
        nameFa: product.nameFa,
        nameEn: product.nameEn,
        salesCount: product.salesCount,
        priceToman: product.priceToman,
        image: product.images[0]?.url ?? null,
      })),
      recentOrders: recentOrders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        totalToman: order.totalToman,
        placedAt: order.placedAt.toISOString(),
        customer: order.user.email,
      })),
    };
  }
}

async function revenue(
  prisma: PrismaService,
  since: Date | null,
): Promise<{ sum: number; count: number }> {
  const result = await prisma.order.aggregate({
    where: { paymentStatus: 'PAID', ...(since ? { paidAt: { gte: since } } : {}) },
    _sum: { totalToman: true },
    _count: true,
  });
  return { sum: result._sum.totalToman ?? 0, count: result._count };
}
