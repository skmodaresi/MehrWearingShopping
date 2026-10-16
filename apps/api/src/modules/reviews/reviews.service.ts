import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '../../generated/prisma/client';
import { ApiException } from '../../common/http/api-exception';
import { paged, Paged, parsePagination } from '../../common/utils/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewDto, UpdateReviewDto } from './dto';

export interface ReviewDto {
  id: string;
  productId: string;
  productSlug?: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  customerName: string;
  createdAt: string;
}

/** Shows only the first name (+ initial) — never the full customer name. */
function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}‌.`;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto): Promise<ReviewDto> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.status !== 'ACTIVE') {
      throw ApiException.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }

    const purchase = await this.prisma.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { userId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      },
    });
    if (!purchase) {
      throw ApiException.forbidden(
        'NOT_PURCHASED',
        'Only verified purchases can review this product',
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId: product.id, userId } },
    });
    if (existing) throw ApiException.conflict('REVIEW_EXISTS', 'You already reviewed this product');

    const review = await this.prisma.review.create({
      data: {
        productId: product.id,
        userId,
        rating: dto.rating,
        title: dto.title ?? null,
        body: dto.body,
        status: 'PENDING',
      },
      include: { user: { select: { fullName: true } }, product: { select: { slug: true } } },
    });

    return {
      id: review.id,
      productId: review.productId,
      productSlug: review.product.slug,
      rating: review.rating,
      title: review.title,
      body: review.body,
      status: review.status,
      customerName: maskName(review.user.fullName),
      createdAt: review.createdAt.toISOString(),
    };
  }

  async updateOwn(userId: string, reviewId: string, dto: UpdateReviewDto): Promise<ReviewDto> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) {
      throw ApiException.notFound('REVIEW_NOT_FOUND', 'Review not found');
    }
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        // Edits go back through moderation.
        status: 'PENDING',
      },
      include: { user: { select: { fullName: true } }, product: { select: { slug: true } } },
    });
    return {
      id: updated.id,
      productId: updated.productId,
      productSlug: updated.product.slug,
      rating: updated.rating,
      title: updated.title,
      body: updated.body,
      status: updated.status,
      customerName: maskName(updated.user.fullName),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async listForProduct(
    slug: string,
    query: { page?: number; limit?: number },
  ): Promise<Paged<ReviewDto>> {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) throw ApiException.notFound('PRODUCT_NOT_FOUND', 'Product not found');

    const params = parsePagination(query);
    const where = { productId: product.id, status: 'APPROVED' as const };
    const [total, items] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: { user: { select: { fullName: true } } },
      }),
    ]);

    return paged(
      items.map((review) => ({
        id: review.id,
        productId: review.productId,
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: review.status,
        customerName: maskName(review.user.fullName),
        createdAt: review.createdAt.toISOString(),
      })),
      total,
      params,
    );
  }

  async listAll(query: {
    status?: ReviewStatus;
    page?: number;
    limit?: number;
  }): Promise<Paged<ReviewDto>> {
    const params = parsePagination(query);
    const where = query.status ? { status: query.status } : {};
    const [total, items] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          user: { select: { fullName: true } },
          product: { select: { slug: true, nameFa: true, nameEn: true } },
        },
      }),
    ]);

    return paged(
      items.map((review) => ({
        id: review.id,
        productId: review.productId,
        productSlug: review.product.slug,
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: review.status,
        customerName: maskName(review.user.fullName),
        createdAt: review.createdAt.toISOString(),
      })),
      total,
      params,
    );
  }

  async setStatus(id: string, status: ReviewStatus): Promise<ReviewDto> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw ApiException.notFound('REVIEW_NOT_FOUND', 'Review not found');

    const updated = await this.prisma.review.update({
      where: { id },
      data: { status },
      include: { user: { select: { fullName: true } }, product: { select: { slug: true } } },
    });
    await this.recomputeRating(updated.productId);

    return {
      id: updated.id,
      productId: updated.productId,
      productSlug: updated.product.slug,
      rating: updated.rating,
      title: updated.title,
      body: updated.body,
      status: updated.status,
      customerName: maskName(updated.user.fullName),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /** Recomputes the denormalized product rating from approved reviews. */
  async recomputeRating(productId: string): Promise<void> {
    const aggregate = await this.prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        ratingCount: aggregate._count,
      },
    });
  }
}
