import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { cardInclude } from '../catalog/catalog.service';
import { ProductCardDto, toProductCard } from '../catalog/mappers';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ProductCardDto[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: cardInclude } },
    });
    return items.map((item) => toProductCard(item.product));
  }

  async add(userId: string, productId: string): Promise<{ success: true; added: boolean }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    });
    if (!product || product.status !== 'ACTIVE') {
      throw ApiException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) return { success: true, added: false };
    await this.prisma.wishlistItem.create({ data: { userId, productId } });
    return { success: true, added: true };
  }

  async remove(userId: string, productId: string): Promise<{ success: true; removed: boolean }> {
    const result = await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { success: true, removed: result.count > 0 };
  }
}
