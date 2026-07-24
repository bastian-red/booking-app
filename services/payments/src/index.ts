import Stripe from 'stripe';

export interface PaymentsConfig {
  enabled: boolean;
  secretKey?: string;
  webhookSecret?: string;
}

export interface CheckoutParams {
  bookingId: string;
  eventTitle: string;
  priceCents: number;
  currency: string;
  guestEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  sessionId: string;
  url: string;
}

/** Normalized outcome of a Stripe webhook we care about. */
export interface ParsedWebhook {
  eventId: string;
  type: string;
  /** Our booking id, carried in session metadata. */
  bookingId?: string;
  sessionId?: string;
  paymentIntentId?: string;
  /** True when this event confirms payment for the booking. */
  isPaymentComplete: boolean;
}

/** Load config from environment. PAYMENTS_ENABLED=false runs without Stripe keys. */
export function paymentsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentsConfig {
  return {
    enabled: env.PAYMENTS_ENABLED === 'true',
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  };
}

/**
 * Pure mapping from a Stripe event object to our normalized shape. Kept separate
 * from signature verification so it can be unit-tested without real signatures.
 */
export function parseWebhookEvent(event: Stripe.Event): ParsedWebhook {
  const base: ParsedWebhook = {
    eventId: event.id,
    type: event.type,
    isPaymentComplete: false,
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      ...base,
      bookingId: session.metadata?.bookingId ?? undefined,
      sessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? undefined),
      // 'paid' for one-time payments; 'no_payment_required' for 100%-off etc.
      isPaymentComplete:
        session.payment_status === 'paid' || session.payment_status === 'no_payment_required',
    };
  }

  return base;
}

export interface PaymentsService {
  isEnabled(): boolean;
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>;
  /** Verify the Stripe signature and return the normalized event. */
  handleWebhook(rawBody: Buffer | string, signature: string): ParsedWebhook;
}

export function createPaymentsService(config: PaymentsConfig): PaymentsService {
  const stripe =
    config.enabled && config.secretKey
      ? new Stripe(config.secretKey, { apiVersion: '2025-02-24.acacia' })
      : undefined;

  return {
    isEnabled() {
      return Boolean(stripe);
    },

    async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
      if (!stripe) {
        throw new Error('Payments are disabled: cannot create a checkout session.');
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: params.guestEmail,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: { bookingId: params.bookingId },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: params.currency,
              unit_amount: params.priceCents,
              product_data: { name: params.eventTitle },
            },
          },
        ],
      });
      if (!session.url) {
        throw new Error('Stripe did not return a checkout URL.');
      }
      return { sessionId: session.id, url: session.url };
    },

    handleWebhook(rawBody: Buffer | string, signature: string): ParsedWebhook {
      if (!stripe || !config.webhookSecret) {
        throw new Error('Payments are disabled: cannot verify a webhook.');
      }
      const event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      return parseWebhookEvent(event);
    },
  };
}
