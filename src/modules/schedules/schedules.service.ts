import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { eq, and, gte, asc } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import {
  doctorSchedules,
  doctorScheduleExceptions,
  clinicDoctors,
  DoctorSchedule,
  DoctorScheduleException,
} from '../../database/schema/doctors';
import { clinics } from '../../database/schema/clinics';
import {
  CreateScheduleDto,
  CreateScheduleExceptionDto,
  ScheduleExceptionStatus,
} from './dto';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Create or update weekly chamber schedule shift for a clinic doctor
   */
  async createOrUpdateSchedule(
    clinicId: string,
    dto: CreateScheduleDto,
  ): Promise<DoctorSchedule> {
    // 1. Verify that the chamber exists and belongs to the active clinic
    const [chamber] = await this.db
      .select({
        id: clinicDoctors.id,
        clinicId: clinicDoctors.clinicId,
        isActive: clinicDoctors.isActive,
      })
      .from(clinicDoctors)
      .innerJoin(clinics, eq(clinicDoctors.clinicId, clinics.id))
      .where(
        and(
          eq(clinicDoctors.id, dto.clinicDoctorId),
          eq(clinicDoctors.clinicId, clinicId),
          eq(clinics.isActive, true),
        ),
      )
      .limit(1);

    if (!chamber) {
      throw new NotFoundException(
        `Doctor chamber with ID "${dto.clinicDoctorId}" was not found in active clinic "${clinicId}"`,
      );
    }

    const maxLimit = dto.maxSerialLimit ?? 40;
    const onlineLimit = dto.onlineBookingLimit ?? 15;

    if (onlineLimit > maxLimit) {
      throw new BadRequestException(
        `onlineBookingLimit (${onlineLimit}) cannot exceed maxSerialLimit (${maxLimit})`,
      );
    }

    // Validate that startTime is strictly earlier than endTime
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);
    if (startH * 60 + startM >= endH * 60 + endM) {
      throw new BadRequestException(
        `startTime (${dto.startTime}) must be strictly earlier than endTime (${dto.endTime})`,
      );
    }

    // 2. Check if a schedule shift already exists for this chamber, day of week, and shift name
    const [existingSchedule] = await this.db
      .select()
      .from(doctorSchedules)
      .where(
        and(
          eq(doctorSchedules.clinicDoctorId, dto.clinicDoctorId),
          eq(doctorSchedules.dayOfWeek, dto.dayOfWeek),
          eq(doctorSchedules.shiftName, dto.shiftName),
        ),
      )
      .limit(1);

    if (existingSchedule) {
      // Update existing schedule
      const [updated] = await this.db
        .update(doctorSchedules)
        .set({
          startTime: dto.startTime,
          endTime: dto.endTime,
          maxSerialLimit: maxLimit,
          onlineBookingLimit: onlineLimit,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        })
        .where(eq(doctorSchedules.id, existingSchedule.id))
        .returning();

      this.logger.log(
        `Updated schedule shift ${updated.id} for chamber ${dto.clinicDoctorId} (${dto.dayOfWeek} ${dto.shiftName})`,
      );
      return updated;
    }

    // 3. Insert new schedule shift
    const [created] = await this.db
      .insert(doctorSchedules)
      .values({
        clinicDoctorId: dto.clinicDoctorId,
        dayOfWeek: dto.dayOfWeek,
        shiftName: dto.shiftName,
        startTime: dto.startTime,
        endTime: dto.endTime,
        maxSerialLimit: maxLimit,
        onlineBookingLimit: onlineLimit,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      })
      .returning();

    this.logger.log(
      `Created new schedule shift ${created.id} for chamber ${dto.clinicDoctorId} (${dto.dayOfWeek} ${dto.shiftName})`,
    );
    return created;
  }

  /**
   * Get all active weekly shifts and upcoming exceptions for a specific clinic doctor chamber
   */
  async getSchedulesByClinicDoctor(clinicDoctorId: string) {
    const [chamber] = await this.db
      .select({
        id: clinicDoctors.id,
        clinicId: clinicDoctors.clinicId,
        doctorId: clinicDoctors.doctorId,
        roomNo: clinicDoctors.roomNo,
        newPatientFee: clinicDoctors.newPatientFee,
        followupFee: clinicDoctors.followupFee,
        reportShowFee: clinicDoctors.reportShowFee,
      })
      .from(clinicDoctors)
      .where(eq(clinicDoctors.id, clinicDoctorId))
      .limit(1);

    if (!chamber) {
      throw new NotFoundException(`Doctor chamber with ID "${clinicDoctorId}" not found`);
    }

    // 1. Fetch active weekly recurring shifts
    const shifts = await this.db
      .select()
      .from(doctorSchedules)
      .where(
        and(
          eq(doctorSchedules.clinicDoctorId, clinicDoctorId),
          eq(doctorSchedules.isActive, true),
        ),
      )
      .orderBy(asc(doctorSchedules.dayOfWeek), asc(doctorSchedules.startTime));

    // 2. Fetch future and today's schedule exceptions
    const today = new Date().toISOString().split('T')[0];
    const exceptions = await this.db
      .select()
      .from(doctorScheduleExceptions)
      .where(
        and(
          eq(doctorScheduleExceptions.clinicDoctorId, clinicDoctorId),
          gte(doctorScheduleExceptions.exceptionDate, today),
        ),
      )
      .orderBy(asc(doctorScheduleExceptions.exceptionDate));

    return {
      chamber,
      schedules: shifts,
      exceptions,
    };
  }

  /**
   * Record a schedule exception (DELAYED or CANCELLED) for a specific date
   */
  async createScheduleException(
    clinicId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<DoctorScheduleException> {
    // 1. Verify that the chamber belongs to the active clinic
    const [chamber] = await this.db
      .select({ id: clinicDoctors.id })
      .from(clinicDoctors)
      .where(
        and(
          eq(clinicDoctors.id, dto.clinicDoctorId),
          eq(clinicDoctors.clinicId, clinicId),
        ),
      )
      .limit(1);

    if (!chamber) {
      throw new NotFoundException(
        `Doctor chamber with ID "${dto.clinicDoctorId}" was not found in clinic "${clinicId}"`,
      );
    }

    // 2. Validate exceptionDate is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (dto.exceptionDate < today) {
      throw new BadRequestException(
        `exceptionDate (${dto.exceptionDate}) cannot be in the past`,
      );
    }

    // 3. Validate delayedStartTime when status is DELAYED
    if (dto.status === ScheduleExceptionStatus.DELAYED && !dto.delayedStartTime) {
      throw new BadRequestException(
        'delayedStartTime is required when schedule exception status is DELAYED',
      );
    }

    // 4. Insert exception
    const [exception] = await this.db
      .insert(doctorScheduleExceptions)
      .values({
        clinicDoctorId: dto.clinicDoctorId,
        exceptionDate: dto.exceptionDate,
        status: dto.status,
        delayedStartTime: dto.delayedStartTime ?? null,
        reason: dto.reason ? dto.reason.trim() : null,
      })
      .returning();

    this.logger.log(
      `Created schedule exception ${exception.id} (${dto.status}) on ${dto.exceptionDate} for chamber ${dto.clinicDoctorId}`,
    );

    return exception;
  }
}
