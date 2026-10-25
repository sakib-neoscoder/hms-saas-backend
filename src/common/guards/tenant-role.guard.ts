import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { ROLES_KEY, ClinicRole } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { clinicMembers } from '../../database/schema/clinics';

@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ClinicRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified for this endpoint, access is permitted
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const clinicId = request.headers['x-clinic-id'] as string | undefined;

    if (!clinicId) {
      throw new BadRequestException('Multi-tenant "x-clinic-id" header is required for this operation');
    }

    // Query active membership for the user in this specific clinic
    const [membership] = await this.db
      .select()
      .from(clinicMembers)
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.userId, user.id),
          eq(clinicMembers.isActive, true),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You do not have an active membership in this clinic');
    }

    // SUPER_ADMIN has global bypass permissions
    if (membership.role === 'SUPER_ADMIN') {
      request.tenantMembership = membership;
      return true;
    }

    const hasPermission = requiredRoles.includes(membership.role as ClinicRole);
    if (!hasPermission) {
      throw new ForbiddenException(
        `Role "${membership.role}" does not have required permissions: [${requiredRoles.join(', ')}]`,
      );
    }

    request.tenantMembership = membership;
    return true;
  }
}
