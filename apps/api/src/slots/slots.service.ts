import { Injectable, NotFoundException } from '@nestjs/common';
import {
  generateSlots,
  isValidSlotStart,
  type SlotEngineInput,
  type SlotDto,
} from '@booking/shared';
import type { EventType, User } from '@booking/db';
import { PrismaService } from '../prisma/prisma.service';

export interface EventTypeWithHost extends EventType {
  host: User;
}

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Load an active event type with its host, or 404. */
  async getEventType(eventTypeId: string): Promise<EventTypeWithHost> {
    const eventType = await this.prisma.eventType.findFirst({
      where: { id: eventTypeId, isActive: true },
      include: { host: true },
    });
    if (!eventType) throw new NotFoundException('Event type not found');
    return eventType;
  }

  private async buildEngineInput(
    eventType: EventTypeWithHost,
    from: Date,
    to: Date,
    guestTimezone: string,
  ): Promise<SlotEngineInput> {
    const hostId = eventType.hostId;
    const [rules, overrides, busy] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { hostId } }),
      this.prisma.availabilityOverride.findMany({ where: { hostId } }),
      this.prisma.booking.findMany({
        where: {
          hostId,
          status: { not: 'CANCELLED' },
          startUtc: { lt: to },
          endUtc: { gt: from },
        },
        select: { startUtc: true, endUtc: true },
      }),
    ]);

    return {
      hostTimezone: eventType.host.timezone,
      guestTimezone,
      rules: rules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      })),
      overrides: overrides.map((o) => ({
        date: o.date.toISOString().slice(0, 10),
        isBlocked: o.isBlocked,
        startMinute: o.startMinute ?? undefined,
        endMinute: o.endMinute ?? undefined,
      })),
      busy,
      durationMinutes: eventType.durationMinutes,
      bufferBeforeMin: eventType.bufferBeforeMin,
      bufferAfterMin: eventType.bufferAfterMin,
      rangeStart: from,
      rangeEnd: to,
      now: new Date(),
    };
  }

  async getSlots(eventTypeId: string, from: Date, to: Date, guestTimezone: string): Promise<SlotDto[]> {
    const eventType = await this.getEventType(eventTypeId);
    const input = await this.buildEngineInput(eventType, from, to, guestTimezone);
    return generateSlots(input).map((s) => ({
      startUtc: s.startUtc.toISOString(),
      endUtc: s.endUtc.toISOString(),
      startInGuestTz: s.startInGuestTz,
    }));
  }

  /**
   * True when `startUtc` is a legitimate, currently-open slot for the event type.
   * Excludes existing busy intervals so a client cannot book an off-grid or
   * already-taken time. The DB exclusion constraint is still the final guard.
   */
  async isBookableStart(eventType: EventTypeWithHost, startUtc: Date, guestTimezone: string): Promise<boolean> {
    // Query busy around the target so buffer conflicts are considered.
    const pad = 24 * 60 * 60 * 1000;
    const input = await this.buildEngineInput(
      eventType,
      new Date(startUtc.getTime() - pad),
      new Date(startUtc.getTime() + pad),
      guestTimezone,
    );
    return isValidSlotStart(input, startUtc);
  }
}
