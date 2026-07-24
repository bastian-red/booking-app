import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { eventTypeInputSchema, type EventTypeInput } from '@booking/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentHost } from '../auth/current-host.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventTypesService } from './event-types.service';

@Controller('event-types')
@UseGuards(AuthGuard)
export class EventTypesController {
  constructor(private readonly service: EventTypesService) {}

  @Get()
  list(@CurrentHost() hostId: string) {
    return this.service.listByHost(hostId);
  }

  @Post()
  create(
    @CurrentHost() hostId: string,
    @Body(new ZodValidationPipe(eventTypeInputSchema)) body: EventTypeInput,
  ) {
    return this.service.create(hostId, body);
  }

  @Patch(':id')
  update(
    @CurrentHost() hostId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(eventTypeInputSchema.partial())) body: Partial<EventTypeInput>,
  ) {
    return this.service.update(hostId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentHost() hostId: string, @Param('id') id: string): Promise<void> {
    await this.service.remove(hostId, id);
  }
}
