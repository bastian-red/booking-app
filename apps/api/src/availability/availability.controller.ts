import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { setAvailabilitySchema, type SetAvailabilityInput } from '@booking/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentHost } from '../auth/current-host.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AvailabilityService } from './availability.service';

@Controller('availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get()
  get(@CurrentHost() hostId: string) {
    return this.service.get(hostId);
  }

  @Put()
  set(
    @CurrentHost() hostId: string,
    @Body(new ZodValidationPipe(setAvailabilitySchema)) body: SetAvailabilityInput,
  ) {
    return this.service.set(hostId, body);
  }
}
