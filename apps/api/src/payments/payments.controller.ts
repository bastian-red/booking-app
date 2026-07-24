import { Controller, Headers, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PaymentsService } from '@booking/payments';
import { Prisma } from '@booking/db';
import { PAYMENTS } from '../core/core.module';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PAYMENTS) private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
  ) {}

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.payments.isEnabled()) {
      res.status(200).json({ ignored: true });
      return;
    }
    if (!req.rawBody || !signature) {
      res.status(400).send('Missing signature or body');
      return;
    }

    let parsed;
    try {
      parsed = this.payments.handleWebhook(req.rawBody, signature);
    } catch {
      res.status(400).send('Invalid signature');
      return;
    }

    // Idempotency: record the event id; a duplicate delivery is a no-op.
    try {
      await this.prisma.stripeEvent.create({ data: { id: parsed.eventId, type: parsed.type } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(200).json({ duplicate: true });
        return;
      }
      throw err;
    }

    if (parsed.isPaymentComplete && parsed.bookingId) {
      await this.bookings.confirmPaid(parsed.bookingId, parsed.paymentIntentId);
    }
    res.status(200).json({ received: true });
  }
}
