import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { eq, and, ilike, or } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import {
  doctors,
  clinicDoctors,
  doctorSchedules,
  Doctor,
  ClinicDoctor,
} from '../../database/schema/doctors';
import { users } from '../../database/schema/users';
import { specialties } from '../../database/schema/specialties';
import { clinics, clinicMembers } from '../../database/schema/clinics';
import { OnboardDoctorDto, UpdateChamberSettingsDto, FilterDoctorsDto } from './dto';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Onboard a doctor to a clinic: creates or updates doctor profile, assigns DOCTOR role in clinic_members,
   * and creates/updates clinic chamber settings inside an atomic transaction.
   */
  async onboardDoctor(clinicId: string, dto: OnboardDoctorDto) {
    const [clinic] = await this.db
      .select({ id: clinics.id, isActive: clinics.isActive })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    if (!clinic.isActive) {
      throw new BadRequestException('Cannot onboard doctors to an inactive or pending clinic');
    }

    const [specialty] = await this.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(eq(specialties.id, dto.specialtyId))
      .limit(1);

    if (!specialty) {
      throw new NotFoundException(`Specialty with ID "${dto.specialtyId}" not found`);
    }

    return await this.db.transaction(async (tx) => {
      // 1. Resolve or create user account for the doctor
      let targetUserId = dto.userId;

      if (!targetUserId && !dto.phone) {
        throw new BadRequestException('Either userId or phone must be provided to onboard a doctor');
      }

      if (!targetUserId && dto.phone) {
        const [existingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.phone, dto.phone.trim()))
          .limit(1);

        if (existingUser) {
          targetUserId = existingUser.id;
        } else {
          // Auto-create user account for the doctor
          const doctorName = dto.fullName?.trim() || `Dr. ${dto.bmdcRegNo}`;
          const [newUser] = await tx
            .insert(users)
            .values({
              phone: dto.phone.trim(),
              fullName: doctorName,
              email: dto.email ? dto.email.trim().toLowerCase() : null,
              isPhoneVerified: true,
              isActive: true,
            })
            .returning();
          targetUserId = newUser.id;
        }
      }

      const [doctorUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, targetUserId!))
        .limit(1);

      if (!doctorUser) {
        throw new NotFoundException(`User with ID "${targetUserId}" not found`);
      }

      // 2. Resolve or upsert global doctors record
      const cleanBmdc = dto.bmdcRegNo.trim().toUpperCase();
      let [existingDoctor] = await tx
        .select()
        .from(doctors)
        .where(or(eq(doctors.userId, targetUserId!), eq(doctors.bmdcRegNo, cleanBmdc)))
        .limit(1);

      let doctorRecord: Doctor;

      if (existingDoctor) {
        if (existingDoctor.userId !== targetUserId) {
          throw new ConflictException(
            `BMDC Reg No "${cleanBmdc}" is already associated with another user account`,
          );
        }

        const [updated] = await tx
          .update(doctors)
          .set({
            specialtyId: dto.specialtyId,
            degrees: dto.degrees.trim(),
            designation: dto.designation?.trim() || existingDoctor.designation,
            rxHeaderBn: dto.rxHeaderBn?.trim() || existingDoctor.rxHeaderBn,
            rxHeaderEn: dto.rxHeaderEn?.trim() || existingDoctor.rxHeaderEn,
            signatureR2Key: dto.signatureR2Key?.trim() || existingDoctor.signatureR2Key,
          })
          .where(eq(doctors.id, existingDoctor.id))
          .returning();
        doctorRecord = updated;
      } else {
        const [created] = await tx
          .insert(doctors)
          .values({
            userId: targetUserId!,
            bmdcRegNo: cleanBmdc,
            specialtyId: dto.specialtyId,
            degrees: dto.degrees.trim(),
            designation: dto.designation?.trim(),
            rxHeaderBn: dto.rxHeaderBn?.trim(),
            rxHeaderEn: dto.rxHeaderEn?.trim(),
            signatureR2Key: dto.signatureR2Key?.trim(),
          })
          .returning();
        doctorRecord = created;
      }

      // 3. Ensure DOCTOR membership in clinic_members
      const [existingMembership] = await tx
        .select()
        .from(clinicMembers)
        .where(
          and(
            eq(clinicMembers.clinicId, clinicId),
            eq(clinicMembers.userId, targetUserId!),
            eq(clinicMembers.role, 'DOCTOR'),
          ),
        )
        .limit(1);

      if (!existingMembership) {
        await tx.insert(clinicMembers).values({
          clinicId,
          userId: targetUserId!,
          role: 'DOCTOR',
          isActive: true,
        });
      } else if (!existingMembership.isActive) {
        await tx
          .update(clinicMembers)
          .set({ isActive: true })
          .where(eq(clinicMembers.id, existingMembership.id));
      }

      // 4. Create or update chamber mapping in clinic_doctors
      const [existingChamber] = await tx
        .select()
        .from(clinicDoctors)
        .where(
          and(
            eq(clinicDoctors.clinicId, clinicId),
            eq(clinicDoctors.doctorId, doctorRecord.id),
          ),
        )
        .limit(1);

      let chamberRecord: ClinicDoctor;

      if (existingChamber) {
        const [updatedChamber] = await tx
          .update(clinicDoctors)
          .set({
            roomNo: dto.roomNo?.trim() || existingChamber.roomNo,
            newPatientFee: dto.newPatientFee,
            followupFee: dto.followupFee,
            followupValidityDays: dto.followupValidityDays ?? existingChamber.followupValidityDays,
            reportShowFee: dto.reportShowFee ?? existingChamber.reportShowFee,
            assistantUserId: dto.assistantUserId || existingChamber.assistantUserId,
            padPrintSettings: dto.padPrintSettings || existingChamber.padPrintSettings,
            isActive: true,
          })
          .where(eq(clinicDoctors.id, existingChamber.id))
          .returning();
        chamberRecord = updatedChamber;
      } else {
        const [newChamber] = await tx
          .insert(clinicDoctors)
          .values({
            clinicId,
            doctorId: doctorRecord.id,
            roomNo: dto.roomNo?.trim(),
            newPatientFee: dto.newPatientFee,
            followupFee: dto.followupFee,
            followupValidityDays: dto.followupValidityDays ?? 30,
            reportShowFee: dto.reportShowFee ?? 0,
            assistantUserId: dto.assistantUserId,
            padPrintSettings: dto.padPrintSettings,
            isActive: true,
          })
          .returning();
        chamberRecord = newChamber;
      }

      this.logger.log(
        `Onboarded doctor ${doctorUser.fullName} (BMDC: ${doctorRecord.bmdcRegNo}) to clinic ${clinicId}`,
      );

      return {
        doctor: doctorRecord,
        user: {
          id: doctorUser.id,
          fullName: doctorUser.fullName,
          phone: doctorUser.phone,
          email: doctorUser.email,
        },
        chamber: chamberRecord,
      };
    });
  }

  /**
   * List doctors with filtering by clinic, specialty, and text search
   */
  async findAll(filter: FilterDoctorsDto) {
    const baseQuery = this.db
      .select({
        doctorId: doctors.id,
        bmdcRegNo: doctors.bmdcRegNo,
        degrees: doctors.degrees,
        designation: doctors.designation,
        rxHeaderBn: doctors.rxHeaderBn,
        rxHeaderEn: doctors.rxHeaderEn,
        signatureR2Key: doctors.signatureR2Key,
        user: {
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
          avatarR2Key: users.avatarR2Key,
        },
        specialty: {
          id: specialties.id,
          nameEn: specialties.nameEn,
          nameBn: specialties.nameBn,
        },
        ...(filter.clinicId
          ? {
              chamber: {
                id: clinicDoctors.id,
                roomNo: clinicDoctors.roomNo,
                newPatientFee: clinicDoctors.newPatientFee,
                followupFee: clinicDoctors.followupFee,
                followupValidityDays: clinicDoctors.followupValidityDays,
                reportShowFee: clinicDoctors.reportShowFee,
                isActive: clinicDoctors.isActive,
              },
            }
          : {}),
      })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .innerJoin(specialties, eq(doctors.specialtyId, specialties.id));

    const conditions = [];

    if (filter.clinicId) {
      baseQuery.innerJoin(
        clinicDoctors,
        and(
          eq(clinicDoctors.doctorId, doctors.id),
          eq(clinicDoctors.clinicId, filter.clinicId),
          eq(clinicDoctors.isActive, true),
        ),
      );
    }

    if (filter.specialtyId) {
      conditions.push(eq(doctors.specialtyId, filter.specialtyId));
    }

    if (filter.search) {
      const searchPattern = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.fullName, searchPattern),
          ilike(doctors.bmdcRegNo, searchPattern),
          ilike(doctors.designation, searchPattern),
        ),
      );
    }

    if (conditions.length > 0) {
      baseQuery.where(and(...conditions));
    }

    const doctorList = await baseQuery;

    // If filtering by clinic, attach schedules for each doctor
    if (filter.clinicId && doctorList.length > 0) {
      const enrichedList = await Promise.all(
        doctorList.map(async (doc: any) => {
          if (!doc.chamber?.id) return { ...doc, schedules: [] };
          const scheduleConditions = [
            eq(doctorSchedules.clinicDoctorId, doc.chamber.id),
            eq(doctorSchedules.isActive, true),
          ];
          if (filter.dayOfWeek) {
            scheduleConditions.push(eq(doctorSchedules.dayOfWeek, filter.dayOfWeek));
          }
          const schedules = await this.db
            .select()
            .from(doctorSchedules)
            .where(and(...scheduleConditions));
          return { ...doc, schedules };
        }),
      );

      // If dayOfWeek filter is specified, only return doctors with active shifts on that day
      if (filter.dayOfWeek) {
        return enrichedList.filter((doc: any) => doc.schedules && doc.schedules.length > 0);
      }

      return enrichedList;
    }

    return doctorList;
  }

  /**
   * Get full doctor profile and all associated chambers across clinics
   */
  async findById(doctorId: string) {
    const [doctor] = await this.db
      .select({
        doctorId: doctors.id,
        bmdcRegNo: doctors.bmdcRegNo,
        degrees: doctors.degrees,
        designation: doctors.designation,
        rxHeaderBn: doctors.rxHeaderBn,
        rxHeaderEn: doctors.rxHeaderEn,
        signatureR2Key: doctors.signatureR2Key,
        createdAt: doctors.createdAt,
        user: {
          id: users.id,
          fullName: users.fullName,
          phone: users.phone,
          email: users.email,
          avatarR2Key: users.avatarR2Key,
        },
        specialty: {
          id: specialties.id,
          nameEn: specialties.nameEn,
          nameBn: specialties.nameBn,
        },
      })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .innerJoin(specialties, eq(doctors.specialtyId, specialties.id))
      .where(eq(doctors.id, doctorId))
      .limit(1);

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${doctorId}" not found`);
    }

    // Fetch all active clinic chambers the doctor practices at
    const chambers = await this.db
      .select({
        chamberId: clinicDoctors.id,
        clinicId: clinics.id,
        clinicName: clinics.name,
        clinicNameBn: clinics.nameBn,
        clinicPhone: clinics.phone,
        clinicAddress: clinics.address,
        district: clinics.district,
        roomNo: clinicDoctors.roomNo,
        newPatientFee: clinicDoctors.newPatientFee,
        followupFee: clinicDoctors.followupFee,
        followupValidityDays: clinicDoctors.followupValidityDays,
        reportShowFee: clinicDoctors.reportShowFee,
        isActive: clinicDoctors.isActive,
      })
      .from(clinicDoctors)
      .innerJoin(clinics, eq(clinicDoctors.clinicId, clinics.id))
      .where(
        and(
          eq(clinicDoctors.doctorId, doctorId),
          eq(clinicDoctors.isActive, true),
          eq(clinics.isActive, true),
        ),
      );

    // Fetch schedules for each chamber
    const chambersWithSchedules = await Promise.all(
      chambers.map(async (chamber) => {
        const schedules = await this.db
          .select()
          .from(doctorSchedules)
          .where(
            and(
              eq(doctorSchedules.clinicDoctorId, chamber.chamberId),
              eq(doctorSchedules.isActive, true),
            ),
          );
        return {
          ...chamber,
          schedules,
        };
      }),
    );

    return {
      ...doctor,
      chambers: chambersWithSchedules,
    };
  }

  /**
   * Update chamber settings (fees, room number, pad settings) for a specific doctor in the calling clinic
   */
  async updateChamberSettings(
    clinicId: string,
    doctorId: string,
    dto: UpdateChamberSettingsDto,
  ): Promise<ClinicDoctor> {
    const [existingChamber] = await this.db
      .select()
      .from(clinicDoctors)
      .where(
        and(
          eq(clinicDoctors.clinicId, clinicId),
          eq(clinicDoctors.doctorId, doctorId),
        ),
      )
      .limit(1);

    if (!existingChamber) {
      throw new NotFoundException(
        `Chamber mapping not found for doctor "${doctorId}" in clinic "${clinicId}"`,
      );
    }

    const [updated] = await this.db
      .update(clinicDoctors)
      .set({
        ...(dto.roomNo !== undefined ? { roomNo: dto.roomNo.trim() } : {}),
        ...(dto.newPatientFee !== undefined ? { newPatientFee: dto.newPatientFee } : {}),
        ...(dto.followupFee !== undefined ? { followupFee: dto.followupFee } : {}),
        ...(dto.followupValidityDays !== undefined
          ? { followupValidityDays: dto.followupValidityDays }
          : {}),
        ...(dto.reportShowFee !== undefined ? { reportShowFee: dto.reportShowFee } : {}),
        ...(dto.assistantUserId !== undefined ? { assistantUserId: dto.assistantUserId } : {}),
        ...(dto.padPrintSettings !== undefined ? { padPrintSettings: dto.padPrintSettings } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      })
      .where(eq(clinicDoctors.id, existingChamber.id))
      .returning();

    this.logger.log(`Updated chamber settings for doctor ${doctorId} in clinic ${clinicId}`);

    return updated;
  }
}
