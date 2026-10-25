import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (required = true, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const clinicId = request.headers['x-clinic-id'] as string | undefined;

    if (!clinicId && required) {
      throw new BadRequestException('Header "x-clinic-id" is missing. Multi-tenant clinic context is required.');
    }

    return clinicId;
  },
);
