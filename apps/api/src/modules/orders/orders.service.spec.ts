import { ORDER_TRANSITIONS } from './orders.service';

/**
 * The order state machine is the most safety-critical pure logic in the
 * system: these tests pin down which transitions exist at all, and that
 * terminal states are terminal.
 */
describe('order state machine', () => {
  it('lets a pending order only be cancelled (payment marks it PAID)', () => {
    expect(ORDER_TRANSITIONS.PENDING).toEqual(['CANCELLED']);
  });

  it('walks the happy path paid → processing → shipped → delivered', () => {
    expect(ORDER_TRANSITIONS.PAID).toContain('PROCESSING');
    expect(ORDER_TRANSITIONS.PROCESSING).toContain('SHIPPED');
    expect(ORDER_TRANSITIONS.SHIPPED).toContain('DELIVERED');
  });

  it('never allows going backwards to PENDING', () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      expect(targets).not.toContain('PENDING');
    }
  });

  it('treats CANCELLED and REFUNDED as terminal', () => {
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ORDER_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it('cannot cancel a shipped order (only refund after delivery)', () => {
    expect(ORDER_TRANSITIONS.SHIPPED).not.toContain('CANCELLED');
  });
});
