import { Global, Module } from '@nestjs/common';
import { createPaymentsService, type PaymentsService } from '@booking/payments';
import { NotificationService, createSmtpChannel } from '@booking/notifications';
import { CONFIG, loadConfig, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QueueService } from '../queue/queue.service';

export const PAYMENTS = Symbol('PAYMENTS');
export const NOTIFICATIONS = Symbol('NOTIFICATIONS');

/** Global infrastructure providers shared by every feature module. */
@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    PrismaService,
    {
      provide: RedisService,
      useFactory: (config: AppConfig) => new RedisService(config.redisUrl),
      inject: [CONFIG],
    },
    {
      provide: QueueService,
      useFactory: (redis: RedisService) => new QueueService(redis.client),
      inject: [RedisService],
    },
    {
      provide: PAYMENTS,
      useFactory: (config: AppConfig): PaymentsService => createPaymentsService(config.payments),
      inject: [CONFIG],
    },
    {
      provide: NOTIFICATIONS,
      useFactory: (config: AppConfig): NotificationService =>
        new NotificationService(createSmtpChannel(config.smtp)),
      inject: [CONFIG],
    },
  ],
  exports: [CONFIG, PrismaService, RedisService, QueueService, PAYMENTS, NOTIFICATIONS],
})
export class CoreModule {}
