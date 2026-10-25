import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ClinicsService } from './clinics.service';
import { DRIZZLE_DB } from '../../database/database.module';
import { QUEUES } from '../../providers/queues/queue.constants';

describe('ClinicsService', () => {
  let service: ClinicsService;
  let mockDb: any;
  let mockSmsQueue: any;

  const mockClinic = {
    id: 'clinic-1111-2222-3333',
    name: 'Popular Diagnostic Center',
    slug: 'popular-diagnostic',
    phone: '01712345678',
    isActive: false,
    subscriptionPlan: 'BASIC',
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };

    mockSmsQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        {
          provide: DRIZZLE_DB,
          useValue: mockDb,
        },
        {
          provide: getQueueToken(QUEUES.SMS),
          useValue: mockSmsQueue,
        },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
  });

  describe('createClinic (Registration & Pending Approval)', () => {
    it('should create clinic with isActive = false and assign creator as CLINIC_ADMIN', async () => {
      mockDb.limit.mockResolvedValue([]); // No existing slug

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn()
                .mockResolvedValueOnce([{ ...mockClinic, isActive: false }])
                .mockResolvedValueOnce([
                  {
                    id: 'member-1',
                    clinicId: mockClinic.id,
                    userId: 'creator-uuid',
                    role: 'CLINIC_ADMIN',
                    isActive: true,
                  },
                ]),
            }),
          }),
        };
        return callback(tx);
      });

      const result = await service.createClinic(
        {
          name: 'Popular Diagnostic Center',
          slug: 'popular-diagnostic',
          phone: '01712345678',
          address: 'Dhanmondi, Dhaka',
          district: 'Dhaka',
        },
        'creator-uuid',
      );

      expect(result.clinic.isActive).toBe(false);
      expect(result.membership.role).toBe('CLINIC_ADMIN');
      expect(result.message).toContain('pending Super Admin approval');
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockDb.limit.mockResolvedValue([{ id: 'existing-id' }]);

      await expect(
        service.createClinic(
          {
            name: 'Popular Diagnostic Center',
            slug: 'popular-diagnostic',
            phone: '01712345678',
            address: 'Dhanmondi, Dhaka',
            district: 'Dhaka',
          },
          'creator-uuid',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approveClinic (Super Admin Workflow)', () => {
    it('should throw NotFoundException if clinic does not exist', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.approveClinic('non-existent-clinic', 'super-admin-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return already active if clinic is already isActive = true', async () => {
      mockDb.limit.mockResolvedValue([{ ...mockClinic, isActive: true }]);

      const result = await service.approveClinic(mockClinic.id, 'super-admin-uuid');
      expect(result.success).toBe(true);
      expect(result.message).toContain('already active');
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should activate clinic and dispatch welcome SMS via BullMQ', async () => {
      // 1. Fetch clinic (inactive)
      mockDb.limit
        .mockResolvedValueOnce([{ ...mockClinic, isActive: false }])
        // 2. Fetch admin user for SMS
        .mockResolvedValueOnce([
          { phone: '01712345678', fullName: 'Dr. Admin' },
        ]);

      mockDb.returning.mockResolvedValue([{ ...mockClinic, isActive: true }]);

      const result = await service.approveClinic(mockClinic.id, 'super-admin-uuid');

      expect(result.success).toBe(true);
      expect(result.clinic.isActive).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSmsQueue.add).toHaveBeenCalledWith(
        'clinic-approval-notification',
        expect.objectContaining({
          phone: '01712345678',
          clinicId: mockClinic.id,
        }),
      );
    });
  });

  describe('assignMember (Staff Management & Security)', () => {
    it('should throw ForbiddenException if clinic is inactive or pending approval', async () => {
      mockDb.limit.mockResolvedValue([{ id: mockClinic.id, isActive: false }]);

      await expect(
        service.assignMember(
          mockClinic.id,
          { phone: '01811112222', role: 'RECEPTIONIST' },
          'CLINIC_ADMIN',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent CLINIC_ADMIN from assigning SUPER_ADMIN role (privilege escalation check)', async () => {
      mockDb.limit.mockResolvedValue([{ id: mockClinic.id, isActive: true }]);

      await expect(
        service.assignMember(
          mockClinic.id,
          { phone: '01811112222', role: 'SUPER_ADMIN' },
          'CLINIC_ADMIN',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN caller to assign SUPER_ADMIN role', async () => {
      // 1. Clinic lookup
      // 2. User lookup by phone
      // 3. User lookup by ID
      // 4. Existing membership check
      mockDb.limit
        .mockResolvedValueOnce([{ id: mockClinic.id, isActive: true }])
        .mockResolvedValueOnce([{ id: 'target-user-uuid' }])
        .mockResolvedValueOnce([{ id: 'target-user-uuid', phone: '01811112222' }])
        .mockResolvedValueOnce([]); // no existing membership

      mockDb.returning.mockResolvedValue([
        {
          id: 'new-membership-uuid',
          clinicId: mockClinic.id,
          userId: 'target-user-uuid',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      ]);

      const result = await service.assignMember(
        mockClinic.id,
        { phone: '01811112222', role: 'SUPER_ADMIN' },
        'SUPER_ADMIN',
      );

      expect(result.role).toBe('SUPER_ADMIN');
    });
  });
});
