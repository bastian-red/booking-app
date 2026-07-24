import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PG_UNIQUE_VIOLATION, Prisma, type EventType } from '@booking/db';
import type { EventTypeInput } from '@booking/shared';
import { PrismaService } from '../prisma/prisma.service';

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === 'P2002' || err.code === PG_UNIQUE_VIOLATION)
  );
}

@Injectable()
export class EventTypesService {
  constructor(private readonly prisma: PrismaService) {}

  listByHost(hostId: string): Promise<EventType[]> {
    return this.prisma.eventType.findMany({ where: { hostId }, orderBy: { createdAt: 'asc' } });
  }

  async getOwned(hostId: string, id: string): Promise<EventType> {
    const et = await this.prisma.eventType.findUnique({ where: { id } });
    if (!et) throw new NotFoundException('Event type not found');
    if (et.hostId !== hostId) throw new ForbiddenException('Not your event type');
    return et;
  }

  async getPublic(id: string): Promise<EventType & { hostName: string; hostTimezone: string }> {
    const et = await this.prisma.eventType.findFirst({
      where: { id, isActive: true },
      include: { host: { select: { name: true, timezone: true } } },
    });
    if (!et) throw new NotFoundException('Event type not found');
    const { host, ...rest } = et;
    return { ...rest, hostName: host.name, hostTimezone: host.timezone };
  }

  async create(hostId: string, input: EventTypeInput): Promise<EventType> {
    try {
      return await this.prisma.eventType.create({ data: { ...input, hostId } });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('An event type with this slug already exists.');
      }
      throw err;
    }
  }

  async update(hostId: string, id: string, input: Partial<EventTypeInput>): Promise<EventType> {
    await this.getOwned(hostId, id);
    try {
      return await this.prisma.eventType.update({ where: { id }, data: input });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('An event type with this slug already exists.');
      }
      throw err;
    }
  }

  async remove(hostId: string, id: string): Promise<void> {
    await this.getOwned(hostId, id);
    await this.prisma.eventType.delete({ where: { id } });
  }
}
