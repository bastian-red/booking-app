import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CoreModule } from './core/core.module';
import { RedisService } from './redis/redis.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { PublicController } from './public/public.controller';
import { EventTypesController } from './event-types/event-types.controller';
import { EventTypesService } from './event-types/event-types.service';
import { AvailabilityController } from './availability/availability.controller';
import { AvailabilityService } from './availability/availability.service';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { SlotsService } from './slots/slots.service';
import { PaymentsController } from './payments/payments.controller';

@Module({
  imports: [
    CoreModule,
    // Rate limiting backed by the existing Redis so limits are shared across
    // instances and survive restarts. Global default is 60 requests/minute per
    // client IP; the auth routes tighten this with @Throttle (see auth.controller).
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60_000, limit: 60 }],
        storage: new ThrottlerStorageRedisService(redis.client),
      }),
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    PublicController,
    EventTypesController,
    AvailabilityController,
    BookingsController,
    PaymentsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AuthGuard,
    AuthService,
    HealthService,
    EventTypesService,
    AvailabilityService,
    SlotsService,
    BookingsService,
  ],
})
export class AppModule {}
