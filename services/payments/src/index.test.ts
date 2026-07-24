import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import { parseWebhookEvent, paymentsConfigFromEnv, createPaymentsService } from './index';

function fakeCheckoutEvent(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  return {
    id: 'evt_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_status: 'paid',
        payment_intent: 'pi_test_1',
        metadata: { bookingId: 'bk_1' },
        ...overrides,
      } as Stripe.Checkout.Session,
    },
  } as unknown as Stripe.Event;
}

describe('paymentsConfigFromEnv', () => {
  it('is disabled unless PAYMENTS_ENABLED=true', () => {
    expect(paymentsConfigFromEnv({}).enabled).toBe(false);
    expect(paymentsConfigFromEnv({ PAYMENTS_ENABLED: 'false' }).enabled).toBe(false);
    expect(paymentsConfigFromEnv({ PAYMENTS_ENABLED: 'true' }).enabled).toBe(true);
  });
});

describe('parseWebhookEvent', () => {
  it('maps a completed paid checkout to a payment-complete result', () => {
    const parsed = parseWebhookEvent(fakeCheckoutEvent());
    expect(parsed).toMatchObject({
      eventId: 'evt_123',
      type: 'checkout.session.completed',
      bookingId: 'bk_1',
      sessionId: 'cs_test_1',
      paymentIntentId: 'pi_test_1',
      isPaymentComplete: true,
    });
  });

  it('does not mark payment complete when unpaid', () => {
    const parsed = parseWebhookEvent(fakeCheckoutEvent({ payment_status: 'unpaid' }));
    expect(parsed.isPaymentComplete).toBe(false);
  });

  it('handles an expanded payment_intent object', () => {
    const parsed = parseWebhookEvent(
      fakeCheckoutEvent({ payment_intent: { id: 'pi_obj' } as Stripe.PaymentIntent }),
    );
    expect(parsed.paymentIntentId).toBe('pi_obj');
  });

  it('ignores unrelated event types', () => {
    const evt = { id: 'evt_x', type: 'customer.created', data: { object: {} } } as unknown as Stripe.Event;
    const parsed = parseWebhookEvent(evt);
    expect(parsed.isPaymentComplete).toBe(false);
    expect(parsed.bookingId).toBeUndefined();
  });
});

describe('createPaymentsService (disabled)', () => {
  it('reports disabled and refuses to create a session', async () => {
    const svc = createPaymentsService({ enabled: false });
    expect(svc.isEnabled()).toBe(false);
    await expect(
      svc.createCheckoutSession({
        bookingId: 'b',
        eventTitle: 't',
        priceCents: 100,
        currency: 'usd',
        guestEmail: 'g@example.com',
        successUrl: 'http://x/s',
        cancelUrl: 'http://x/c',
      }),
    ).rejects.toThrow(/disabled/);
  });
});
