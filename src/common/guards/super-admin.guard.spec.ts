import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SuperAdminGuard, SYSTEM_SUPER_ADMIN_PHONE } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;
  let mockDb: any;

  const createMockContext = (user?: any): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    guard = new SuperAdminGuard(mockDb);
  });

  it('should throw UnauthorizedException if no user is authenticated', async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access immediately if user phone is root system super admin (01700000000)', async () => {
    const context = createMockContext({
      id: 'super-admin-uuid',
      phone: SYSTEM_SUPER_ADMIN_PHONE,
      fullName: 'System Super Admin',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('should allow access if user has active SUPER_ADMIN role in clinic_members', async () => {
    const context = createMockContext({
      id: 'delegated-super-admin-uuid',
      phone: '01899999999',
      fullName: 'Delegated Admin',
    });

    mockDb.limit.mockResolvedValue([{ id: 'membership-uuid' }]);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('should throw ForbiddenException if user has neither root phone nor SUPER_ADMIN membership', async () => {
    const context = createMockContext({
      id: 'regular-user-uuid',
      phone: '01711112222',
      fullName: 'Regular User',
    });

    mockDb.limit.mockResolvedValue([]);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Only System Super Admin can perform this action',
    );
  });
});
