import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { clinicMembers } from '../../database/schema/clinics';

export const SYSTEM_SUPER_ADMIN_PHONE = '01700000000';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    // 1. Direct match for root System Super Admin phone
    if (user.phone === SYSTEM_SUPER_ADMIN_PHONE) {
      return true;
    }

    // 2. Or check if user possesses SUPER_ADMIN role in clinic_members
    const [membership] = await this.db
      .select({ id: clinicMembers.id })
      .from(clinicMembers)
      .where(
        and(
          eq(clinicMembers.userId, user.id),
          eq(clinicMembers.role, 'SUPER_ADMIN'),
          eq(clinicMembers.isActive, true),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('Only System Super Admin can perform this action');
    }

    return true;
  }
}
