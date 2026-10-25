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
import { UUID_REGEX } from '../decorators/current-tenant.decorator';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { clinics, clinicMembers } from '../../database/schema/clinics';

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

    if (!UUID_REGEX.test(clinicId)) {
      throw new BadRequestException('Invalid x-clinic-id UUID format');
    }

    // Query all active memberships for the user in this specific clinic, joining clinics to verify clinic status
    const memberships = await this.db
      .select({
        id: clinicMembers.id,
        clinicId: clinicMembers.clinicId,
        userId: clinicMembers.userId,
        role: clinicMembers.role,
        isActive: clinicMembers.isActive,
        createdAt: clinicMembers.createdAt,
        clinicIsActive: clinics.isActive,
      })
      .from(clinicMembers)
      .innerJoin(clinics, eq(clinicMembers.clinicId, clinics.id))
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.userId, user.id),
          eq(clinicMembers.isActive, true),
        ),
      );

    if (!memberships || memberships.length === 0) {
      throw new ForbiddenException('You do not have an active membership in this clinic');
    }

    // Verify clinic tenant itself is active
    if (!memberships[0].clinicIsActive) {
      throw new ForbiddenException('This clinic tenant is currently inactive');
    }

    // SUPER_ADMIN has global bypass permissions within the tenant
    const superAdminMembership = memberships.find((m) => m.role === 'SUPER_ADMIN');
    if (superAdminMembership) {
      request.tenantMemberships = memberships;
      request.tenantMembership = superAdminMembership;
      return true;
    }

    // Multi-role check: grant access if any of user's active roles in this clinic matches required roles
    const matchedMembership = memberships.find((m) =>
      requiredRoles.includes(m.role as ClinicRole),
    );

    if (!matchedMembership) {
      const userRoles = memberships.map((m) => m.role).join(', ');
      throw new ForbiddenException(
        `Role(s) [${userRoles}] do not have required permissions: [${requiredRoles.join(', ')}]`,
      );
    }

    request.tenantMemberships = memberships;
    request.tenantMembership = matchedMembership;
    return true;
  }
}
