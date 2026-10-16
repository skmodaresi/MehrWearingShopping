/**
 * Order pricing — a pure function so checkout math is unit-testable and
 * identical in every client. All money is integer Toman.
 */
import { ShippingMethod } from '../../generated/prisma/client';
import { discountFor, ValidatedCoupon } from '../coupons/coupons.service';

export interface PricingConfig {
  standardCost: number;
  expressCost: number;
  freeShippingThreshold: number;
}

export interface LineInput {
  unitPriceToman: number;
  qty: number;
}

export interface Totals {
  subtotalToman: number;
  discountToman: number;
  shippingCostToman: number;
  totalToman: number;
}

export function shippingCostFor(
  method: ShippingMethod,
  config: PricingConfig,
  subtotalAfterDiscount: number,
  coupon: Pick<ValidatedCoupon, 'type'> | null,
): number {
  if (coupon?.type === 'SHIPPING') return 0;
  const base = method === 'EXPRESS' ? config.expressCost : config.standardCost;
  if (subtotalAfterDiscount >= config.freeShippingThreshold) return 0;
  return base;
}

export function computeTotals(
  lines: LineInput[],
  options: {
    coupon?: Pick<ValidatedCoupon, 'type' | 'value' | 'maxDiscountToman'> | null;
    shippingMethod: ShippingMethod;
    config: PricingConfig;
  },
): Totals {
  const subtotalToman = lines.reduce((sum, line) => sum + line.unitPriceToman * line.qty, 0);
  const discountToman = options.coupon ? discountFor(options.coupon, subtotalToman) : 0;
  const payable = Math.max(0, subtotalToman - discountToman);
  const shippingCostToman = shippingCostFor(
    options.shippingMethod,
    options.config,
    payable,
    options.coupon ?? null,
  );
  return {
    subtotalToman,
    discountToman,
    shippingCostToman,
    totalToman: payable + shippingCostToman,
  };
}
