import { Injectable } from '@nestjs/common';
import type { SetAvailabilityInput } from '@booking/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AvailabilityDto {
  timezone: string;
  rules: { dayOfWeek: number; startMinute: number; endMinute: number }[];
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(hostId: string): Promise<AvailabilityDto> {
    const [user, rules] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: hostId }, select: { timezone: true } }),
      this.prisma.availabilityRule.findMany({
        where: { hostId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      }),
    ]);
    return {
      timezone: user.timezone,
      rules: rules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      })),
    };
  }

  /** Replace the host's timezone + weekly rules atomically. */
  async set(hostId: string, input: SetAvailabilityInput): Promise<AvailabilityDto> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: hostId }, data: { timezone: input.timezone } }),
      this.prisma.availabilityRule.deleteMany({ where: { hostId } }),
      this.prisma.availabilityRule.createMany({
        data: input.rules.map((r) => ({
          hostId,
          dayOfWeek: r.dayOfWeek,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
        })),
      }),
    ]);
    return this.get(hostId);
  }
}
