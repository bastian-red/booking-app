import { Controller, Get, UseGuards } from '@nestjs/common';
import type { BookingDto } from '@booking/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentHost } from '../auth/current-host.decorator';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@CurrentHost() hostId: string): Promise<BookingDto[]> {
    return this.bookings.listByHost(hostId);
  }
}
