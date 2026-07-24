import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
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
  imports: [CoreModule],
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
