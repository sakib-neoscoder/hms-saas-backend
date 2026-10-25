import { ExecutionContext, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRoleGuard } from './tenant-role.guard';

describe('TenantRoleGuard', () => {
  let guard: TenantRoleGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockDb: any;

  const validClinicId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const mockUser = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    phone: '01712345678',
    fullName: 'Dr. Test User',
    isPhoneVerified: true,
    isActive: true,
  };

  const createMockContext = (
    headers: Record<string, string> = {},
    user: any = mockUser,
  ): { context: ExecutionContext; request: any } => {
    const request = {
      headers,
      user,
      tenantMembership: undefined,
      tenantMemberships: undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn(),
    };

    guard = new TenantRoleGuard(reflector, mockDb);
  });

  it('should allow access if no roles are required on the endpoint', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const { context } = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if user is not authenticated', async () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const { context } = createMockContext({}, null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw BadRequestException if x-clinic-id header is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Multi-tenant "x-clinic-id" header is required for this operation',
    );
  });

  it('should throw BadRequestException if x-clinic-id is not a valid UUID format', async () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const { context } = createMockContext({ 'x-clinic-id': 'invalid-uuid-12345' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid x-clinic-id UUID format');
  });

  it('should throw ForbiddenException if user has no active membership in the clinic', async () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const { context } = createMockContext({ 'x-clinic-id': validClinicId });

    mockDb.where.mockResolvedValue([]);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'You do not have an active membership in this clinic',
    );
  });

  it('should throw ForbiddenException if clinic tenant is inactive', async () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const { context } = createMockContext({ 'x-clinic-id': validClinicId });

    mockDb.where.mockResolvedValue([
      {
        id: 'm1',
        clinicId: validClinicId,
        userId: mockUser.id,
        role: 'DOCTOR',
        isActive: true,
        clinicIsActive: false, // Inactive clinic!
      },
    ]);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'This clinic tenant is currently inactive',
    );
  });

  it('should grant access to SUPER_ADMIN regardless of required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(['LAB_TECH']);
    const { context, request } = createMockContext({ 'x-clinic-id': validClinicId });

    const superAdminMembership = {
      id: 'm-super',
      clinicId: validClinicId,
      userId: mockUser.id,
      role: 'SUPER_ADMIN',
      isActive: true,
      clinicIsActive: true,
    };

    mockDb.where.mockResolvedValue([superAdminMembership]);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.tenantMembership).toEqual(superAdminMembership);
  });

  it('should resolve multi-role correctly when user holds multiple roles (e.g. RECEPTIONIST + DOCTOR)', async () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const { context, request } = createMockContext({ 'x-clinic-id': validClinicId });

    const memberships = [
      {
        id: 'm1',
        clinicId: validClinicId,
        userId: mockUser.id,
        role: 'RECEPTIONIST',
        isActive: true,
        clinicIsActive: true,
      },
      {
        id: 'm2',
        clinicId: validClinicId,
        userId: mockUser.id,
        role: 'DOCTOR',
        isActive: true,
        clinicIsActive: true,
      },
    ];

    mockDb.where.mockResolvedValue(memberships);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.tenantMemberships).toHaveLength(2);
    expect(request.tenantMembership.role).toBe('DOCTOR');
  });

  it('should throw ForbiddenException if none of user multiple roles match required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(['CLINIC_ADMIN']);
    const { context } = createMockContext({ 'x-clinic-id': validClinicId });

    const memberships = [
      {
        id: 'm1',
        clinicId: validClinicId,
        userId: mockUser.id,
        role: 'RECEPTIONIST',
        isActive: true,
        clinicIsActive: true,
      },
      {
        id: 'm2',
        clinicId: validClinicId,
        userId: mockUser.id,
        role: 'ASSISTANT',
        isActive: true,
        clinicIsActive: true,
      },
    ];

    mockDb.where.mockResolvedValue(memberships);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Role(s) [RECEPTIONIST, ASSISTANT] do not have required permissions: [CLINIC_ADMIN]',
    );
  });
});
