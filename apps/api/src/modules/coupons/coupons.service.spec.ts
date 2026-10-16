import { discountFor } from './coupons.service';

describe('coupon discount math', () => {
  it('computes percentage discounts', () => {
    expect(discountFor({ type: 'PERCENT', value: 10, maxDiscountToman: null }, 800000)).toBe(80000);
    expect(discountFor({ type: 'PERCENT', value: 15, maxDiscountToman: null }, 999999)).toBe(
      149999,
    );
  });

  it('caps percentage discounts at maxDiscountToman', () => {
    expect(discountFor({ type: 'PERCENT', value: 10, maxDiscountToman: 300000 }, 8000000)).toBe(
      300000,
    );
  });

  it('applies fixed discounts up to the subtotal', () => {
    expect(discountFor({ type: 'FIXED', value: 50000, maxDiscountToman: null }, 400000)).toBe(
      50000,
    );
    expect(discountFor({ type: 'FIXED', value: 500000, maxDiscountToman: null }, 400000)).toBe(
      400000,
    );
  });

  it('produces no line discount for shipping coupons', () => {
    expect(discountFor({ type: 'SHIPPING', value: 0, maxDiscountToman: null }, 900000)).toBe(0);
  });
});
