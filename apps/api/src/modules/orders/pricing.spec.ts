import { computeTotals, shippingCostFor } from './pricing';

const config = {
  standardCost: 35000,
  expressCost: 89000,
  freeShippingThreshold: 1500000,
};

describe('order pricing', () => {
  it('sums line totals into the subtotal', () => {
    const totals = computeTotals(
      [
        { unitPriceToman: 489000, qty: 1 },
        { unitPriceToman: 690000, qty: 1 },
      ],
      { shippingMethod: 'STANDARD', config },
    );
    expect(totals.subtotalToman).toBe(489000 + 690000); // under free-shipping threshold
    expect(totals.discountToman).toBe(0);
    expect(totals.shippingCostToman).toBe(35000);
    expect(totals.totalToman).toBe(totals.subtotalToman + 35000);
  });

  it('applies percent coupons before shipping', () => {
    const totals = computeTotals([{ unitPriceToman: 1000000, qty: 1 }], {
      coupon: { type: 'PERCENT', value: 10, maxDiscountToman: null },
      shippingMethod: 'STANDARD',
      config,
    });
    expect(totals.discountToman).toBe(100000);
    // 900 000 is below the free-shipping threshold → shipping still applies
    expect(totals.shippingCostToman).toBe(35000);
    expect(totals.totalToman).toBe(935000);
  });

  it('gives free shipping with a SHIPPING coupon', () => {
    const totals = computeTotals([{ unitPriceToman: 300000, qty: 1 }], {
      coupon: { type: 'SHIPPING', value: 0, maxDiscountToman: null },
      shippingMethod: 'EXPRESS',
      config,
    });
    expect(totals.discountToman).toBe(0);
    expect(totals.shippingCostToman).toBe(0);
    expect(totals.totalToman).toBe(300000);
  });

  it('gives free shipping above the threshold even without a coupon', () => {
    const totals = computeTotals([{ unitPriceToman: 2000000, qty: 1 }], {
      shippingMethod: 'STANDARD',
      config,
    });
    expect(totals.shippingCostToman).toBe(0);
    expect(totals.totalToman).toBe(2000000);
  });

  it('charges express pricing for express delivery', () => {
    expect(shippingCostFor('EXPRESS', config, 100000, null)).toBe(89000);
    expect(shippingCostFor('STANDARD', config, 100000, null)).toBe(35000);
  });

  it('never lets a fixed coupon push the total below zero', () => {
    const totals = computeTotals([{ unitPriceToman: 40000, qty: 1 }], {
      coupon: { type: 'FIXED', value: 500000, maxDiscountToman: null },
      shippingMethod: 'STANDARD',
      config,
    });
    expect(totals.discountToman).toBe(40000);
    expect(totals.totalToman).toBe(35000); // just the shipping
  });
});
