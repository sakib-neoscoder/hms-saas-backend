import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { DRIZZLE_DB } from '../../database/database.module';
import { DayOfWeek, ShiftName, ScheduleExceptionStatus } from './dto';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let mockDb: any;

  const validClinicId = 'clinic-1111-2222-3333';
  const validClinicDoctorId = 'cd-1111-2222-3333';

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: DRIZZLE_DB,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
  });

  describe('createOrUpdateSchedule', () => {
    it('should throw NotFoundException if chamber does not exist or clinic is inactive', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.createOrUpdateSchedule(validClinicId, {
          clinicDoctorId: validClinicDoctorId,
          dayOfWeek: DayOfWeek.SAT,
          shiftName: ShiftName.EVENING,
          startTime: '17:00',
          endTime: '21:00',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if onlineBookingLimit exceeds maxSerialLimit', async () => {
      mockDb.limit.mockResolvedValue([
        { id: validClinicDoctorId, clinicId: validClinicId, isActive: true },
      ]);

      await expect(
        service.createOrUpdateSchedule(validClinicId, {
          clinicDoctorId: validClinicDoctorId,
          dayOfWeek: DayOfWeek.SAT,
          shiftName: ShiftName.EVENING,
          startTime: '17:00',
          endTime: '21:00',
          maxSerialLimit: 20,
          onlineBookingLimit: 30, // Exceeds max limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if startTime is not earlier than endTime', async () => {
      mockDb.limit.mockResolvedValue([
        { id: validClinicDoctorId, clinicId: validClinicId, isActive: true },
      ]);

      await expect(
        service.createOrUpdateSchedule(validClinicId, {
          clinicDoctorId: validClinicDoctorId,
          dayOfWeek: DayOfWeek.SAT,
          shiftName: ShiftName.EVENING,
          startTime: '21:00',
          endTime: '17:00', // Inverted time
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should insert new shift if schedule does not already exist', async () => {
      // 1. Chamber check
      // 2. Existing shift check
      mockDb.limit
        .mockResolvedValueOnce([
          { id: validClinicDoctorId, clinicId: validClinicId, isActive: true },
        ])
        .mockResolvedValueOnce([]); // No existing shift

      const newShift = {
        id: 'shift-1',
        clinicDoctorId: validClinicDoctorId,
        dayOfWeek: DayOfWeek.SAT,
        shiftName: ShiftName.EVENING,
        startTime: '17:00',
        endTime: '21:00',
        maxSerialLimit: 40,
        onlineBookingLimit: 15,
        isActive: true,
      };

      mockDb.returning.mockResolvedValue([newShift]);

      const result = await service.createOrUpdateSchedule(validClinicId, {
        clinicDoctorId: validClinicDoctorId,
        dayOfWeek: DayOfWeek.SAT,
        shiftName: ShiftName.EVENING,
        startTime: '17:00',
        endTime: '21:00',
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(newShift);
    });

    it('should update existing shift if one already exists', async () => {
      // 1. Chamber check
      // 2. Existing shift check
      mockDb.limit
        .mockResolvedValueOnce([
          { id: validClinicDoctorId, clinicId: validClinicId, isActive: true },
        ])
        .mockResolvedValueOnce([{ id: 'existing-shift-id' }]);

      const updatedShift = {
        id: 'existing-shift-id',
        clinicDoctorId: validClinicDoctorId,
        dayOfWeek: DayOfWeek.SAT,
        shiftName: ShiftName.EVENING,
        startTime: '18:00',
        endTime: '22:00',
        maxSerialLimit: 50,
        onlineBookingLimit: 20,
        isActive: true,
      };

      mockDb.returning.mockResolvedValue([updatedShift]);

      const result = await service.createOrUpdateSchedule(validClinicId, {
        clinicDoctorId: validClinicDoctorId,
        dayOfWeek: DayOfWeek.SAT,
        shiftName: ShiftName.EVENING,
        startTime: '18:00',
        endTime: '22:00',
        maxSerialLimit: 50,
        onlineBookingLimit: 20,
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updatedShift);
    });
  });

  describe('getSchedulesByClinicDoctor', () => {
    it('should throw NotFoundException if chamber does not exist', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.getSchedulesByClinicDoctor('non-existent-cd'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return chamber, shifts, and exceptions', async () => {
      const mockChamber = {
        id: validClinicDoctorId,
        clinicId: validClinicId,
        doctorId: 'doc-1',
        roomNo: '401',
        newPatientFee: 1000,
        followupFee: 600,
        reportShowFee: 300,
      };

      mockDb.limit.mockResolvedValue([mockChamber]);
      mockDb.orderBy
        .mockResolvedValueOnce([{ id: 'shift-1', dayOfWeek: 'SAT', startTime: '17:00' }])
        .mockResolvedValueOnce([{ id: 'ex-1', status: 'CANCELLED', exceptionDate: '2026-11-01' }]);

      const result = await service.getSchedulesByClinicDoctor(validClinicDoctorId);

      expect(result.chamber).toEqual(mockChamber);
      expect(result.schedules).toHaveLength(1);
      expect(result.exceptions).toHaveLength(1);
    });
  });

  describe('createScheduleException', () => {
    it('should throw NotFoundException if chamber does not belong to clinic', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.createScheduleException(validClinicId, {
          clinicDoctorId: validClinicDoctorId,
          exceptionDate: '2026-11-01',
          status: ScheduleExceptionStatus.CANCELLED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if exceptionDate is in the past', async () => {
      mockDb.limit.mockResolvedValue([{ id: validClinicDoctorId }]);

      await expect(
        service.createScheduleException(validClinicId, {
          clinicDoctorId: validClinicDoctorId,
          exceptionDate: '2020-01-01', // Past date
          status: ScheduleExceptionStatus.CANCELLED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if status is DELAYED without delayedStartTime', async () => {
      mockDb.limit.mockResolvedValue([{ id: validClinicDoctorId }]);

      await expect(
        service.createScheduleException(validClinicId, {
          clinicDoctorId: validClinicDoctorId,
          exceptionDate: '2026-11-01',
          status: ScheduleExceptionStatus.DELAYED,
          // delayedStartTime missing
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should insert exception when inputs are valid', async () => {
      mockDb.limit.mockResolvedValue([{ id: validClinicDoctorId }]);

      const createdException = {
        id: 'exception-1',
        clinicDoctorId: validClinicDoctorId,
        exceptionDate: '2026-11-01',
        status: ScheduleExceptionStatus.DELAYED,
        delayedStartTime: '18:30',
        reason: 'Emergency surgery',
      };

      mockDb.returning.mockResolvedValue([createdException]);

      const result = await service.createScheduleException(validClinicId, {
        clinicDoctorId: validClinicDoctorId,
        exceptionDate: '2026-11-01',
        status: ScheduleExceptionStatus.DELAYED,
        delayedStartTime: '18:30',
        reason: 'Emergency surgery',
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(createdException);
    });
  });
});
