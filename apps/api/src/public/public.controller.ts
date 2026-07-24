import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  createBookingSchema,
  slotsQuerySchema,
  type BookingDto,
  type CreateBookingInput,
  type SlotDto,
  type SlotsQuery,
} from '@booking/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventTypesService } from '../event-types/event-types.service';
import { SlotsService } from '../slots/slots.service';
import { BookingsService } from '../bookings/bookings.service';

/** Unauthenticated endpoints used by guests booking through a public link. */
@Controller('public')
export class PublicController {
  constructor(
    private readonly eventTypes: EventTypesService,
    private readonly slots: SlotsService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('event-types/:id')
  getEventType(@Param('id') id: string) {
    return this.eventTypes.getPublic(id);
  }

  @Get('event-types/:id/slots')
  getSlots(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(slotsQuerySchema)) query: SlotsQuery,
  ): Promise<SlotDto[]> {
    return this.slots.getSlots(id, new Date(query.from), new Date(query.to), query.tz);
  }

  @Post('bookings')
  createBooking(
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput,
  ): Promise<BookingDto> {
    return this.bookings.create(body);
  }

  @Get('bookings/:id')
  getBooking(@Param('id') id: string): Promise<BookingDto> {
    return this.bookings.getById(id);
  }
}
