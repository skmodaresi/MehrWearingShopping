import { mockSignature, MockPaymentProvider } from './mock.provider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  it('produces a signed gateway URL for the order', async () => {
    const result = await provider.createPayment({
      id: 'order-1',
      orderNumber: 'MW-ABCDEF123456',
      totalToman: 1250000,
      locale: 'fa-IR',
      description: 'test',
    });
    expect(result.gatewayUrl).toContain('/api/v1/payments/mock/checkout');
    expect(result.gatewayUrl).toContain('order=MW-ABCDEF123456');
    expect(result.authority).toBe('MOCK-MW-ABCDEF123456');
  });

  it('verifies only links it signed for that exact order and amount', async () => {
    const signature = mockSignature('MW-ABCDEF123456', 1250000);

    const good = await provider.verify({
      authority: 'MOCK-MW-ABCDEF123456',
      amountToman: 1250000,
      signature,
    });
    expect(good.ok).toBe(true);
    expect(good.transactionId).toMatch(/^MOCKTX-/);

    const tampered = await provider.verify({
      authority: 'MOCK-MW-ABCDEF123456',
      amountToman: 1, // attacker lowers the amount
      signature,
    });
    expect(tampered.ok).toBe(false);

    const unsigned = await provider.verify({
      authority: 'MOCK-MW-ABCDEF123456',
      amountToman: 1250000,
    });
    expect(unsigned.ok).toBe(false);
  });
});
