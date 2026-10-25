import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CurrentTenant = createParamDecorator(
  (required = true, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const clinicId = request.headers['x-clinic-id'] as string | undefined;

    if (!clinicId) {
      if (required) {
        throw new BadRequestException('Header "x-clinic-id" is missing. Multi-tenant clinic context is required.');
      }
      return undefined;
    }

    if (!UUID_REGEX.test(clinicId)) {
      throw new BadRequestException('Invalid x-clinic-id UUID format');
    }

    return clinicId;
  },
);
