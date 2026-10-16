import { Injectable } from '@nestjs/common';
import { CouponType } from '../../generated/prisma/client';
import { ApiException } from '../../common/http/api-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ValidatedCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  maxDiscountToman: number | null;
  usedCount: number;
  usageLimit: number | null;
  descriptionFa: string;
  descriptionEn: string;
}

export interface CouponPreview {
  code: string;
  type: CouponType;
  value: number;
  discountToman: number;
  freeShipping: boolean;
  descriptionFa: string;
  descriptionEn: string;
}

/**
 * Coupon rules:
 *  - PERCENT   → percentage of the subtotal, capped by maxDiscountToman
 *  - FIXED     → flat Toman reduction (never below zero)
 *  - SHIPPING  → zero shipping cost
 * Validation is pure and shared by checkout and the public preview endpoint.
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    code: string,
    subtotalToman: number,
    at: Date = new Date(),
  ): Promise<ValidatedCoupon> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon) throw ApiException.badRequest('COUPON_NOT_FOUND', 'Coupon code does not exist');
    if (!coupon.isActive)
      throw ApiException.badRequest('COUPON_INACTIVE', 'Coupon is no longer active');
    if (coupon.startsAt && coupon.startsAt > at) {
      throw ApiException.badRequest('COUPON_NOT_STARTED', 'Coupon is not active yet');
    }
    if (coupon.expiresAt && coupon.expiresAt < at) {
      throw ApiException.badRequest('COUPON_EXPIRED', 'Coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw ApiException.badRequest('COUPON_EXHAUSTED', 'Coupon usage limit reached');
    }
    if (subtotalToman < coupon.minOrderToman) {
      throw ApiException.badRequest(
        'COUPON_MIN_ORDER',
        `Coupon requires a minimum order of ${coupon.minOrderToman} Toman`,
        { minOrderToman: coupon.minOrderToman },
      );
    }
    return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscountToman: coupon.maxDiscountToman,
      usedCount: coupon.usedCount,
      usageLimit: coupon.usageLimit,
      descriptionFa: coupon.descriptionFa,
      descriptionEn: coupon.descriptionEn,
    };
  }

  async preview(code: string, subtotalToman: number): Promise<CouponPreview> {
    const coupon = await this.validate(code, subtotalToman);
    return {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountToman: discountFor(coupon, subtotalToman),
      freeShipping: coupon.type === 'SHIPPING',
      descriptionFa: coupon.descriptionFa,
      descriptionEn: coupon.descriptionEn,
    };
  }

  // --- admin --------------------------------------------------------------

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CouponWriteInput) {
    if (!dto.code || dto.type === undefined || dto.value === undefined) {
      throw ApiException.badRequest('INVALID_COUPON', 'code, type and value are required');
    }
    return this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        type: dto.type,
        value: dto.value,
        maxDiscountToman: dto.maxDiscountToman ?? null,
        minOrderToman: dto.minOrderToman ?? 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
        descriptionFa: dto.descriptionFa ?? '',
        descriptionEn: dto.descriptionEn ?? '',
      },
    });
  }

  async update(id: string, dto: Partial<CouponWriteInput>) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw ApiException.notFound('COUPON_NOT_FOUND', 'Coupon not found');
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.maxDiscountToman !== undefined
          ? { maxDiscountToman: dto.maxDiscountToman ?? null }
          : {}),
        ...(dto.minOrderToman !== undefined ? { minOrderToman: dto.minOrderToman } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.descriptionFa !== undefined ? { descriptionFa: dto.descriptionFa } : {}),
        ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn } : {}),
      },
    });
  }
}

/** Wire format accepted by the admin endpoints (ISO strings for dates). */
export interface CouponWriteInput {
  code: string;
  type: CouponType;
  value: number;
  maxDiscountToman?: number | null;
  minOrderToman?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
  descriptionFa?: string;
  descriptionEn?: string;
}

/** Pure money math — covered by unit tests. */
export function discountFor(
  coupon: Pick<ValidatedCoupon, 'type' | 'value' | 'maxDiscountToman'>,
  subtotalToman: number,
): number {
  switch (coupon.type) {
    case 'PERCENT': {
      const raw = Math.floor((subtotalToman * coupon.value) / 100);
      return coupon.maxDiscountToman !== null ? Math.min(raw, coupon.maxDiscountToman) : raw;
    }
    case 'FIXED':
      return Math.min(coupon.value, subtotalToman);
    case 'SHIPPING':
      return 0;
    default:
      return 0;
  }
}
