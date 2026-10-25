import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { clinics, clinicMembers, Clinic, ClinicMember } from '../../database/schema/clinics';
import { users } from '../../database/schema/users';
import { CreateClinicDto, AssignMemberDto } from './dto';
import { QUEUES, SendSmsJobData } from '../../providers/queues/queue.constants';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @InjectQueue(QUEUES.SMS) private readonly smsQueue: Queue<SendSmsJobData>,
  ) {}

  /**
   * Submit a new clinic registration request.
   * Clinic is created with isActive: false (Pending Approval).
   * The creator is automatically assigned as CLINIC_ADMIN inside an atomic transaction.
   */
  async createClinic(
    dto: CreateClinicDto,
    creatorUserId: string,
  ): Promise<{ clinic: Clinic; membership: ClinicMember; message: string }> {
    const cleanSlug = dto.slug.trim().toLowerCase();

    const [existing] = await this.db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.slug, cleanSlug))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Clinic slug "${cleanSlug}" is already taken`);
    }

    return await this.db.transaction(async (tx) => {
      // 1. Resolve or auto-provision target Clinic Admin if adminPhone is specified
      let assignedAdminUserId = creatorUserId;

      if (dto.adminPhone) {
        const cleanAdminPhone = dto.adminPhone.trim();
        const [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, cleanAdminPhone))
          .limit(1);

        if (existingUser) {
          assignedAdminUserId = existingUser.id;
        } else {
          const passwordHash = dto.adminPassword
            ? await bcrypt.hash(dto.adminPassword, 10)
            : null;
          const [newUser] = await tx
            .insert(users)
            .values({
              phone: cleanAdminPhone,
              fullName: dto.adminName?.trim() || `${dto.name} Admin`,
              passwordHash,
              isPhoneVerified: true,
              isActive: true,
            })
            .returning();
          assignedAdminUserId = newUser.id;
        }
      }

      const [newClinic] = await tx
        .insert(clinics)
        .values({
          name: dto.name.trim(),
          nameBn: dto.nameBn?.trim(),
          slug: cleanSlug,
          phone: dto.phone.trim(),
          address: dto.address.trim(),
          district: dto.district.trim(),
          upazila: dto.upazila?.trim(),
          dghsRegNo: dto.dghsRegNo?.trim(),
          smsSenderId: dto.smsSenderId?.trim(),
          smsBalance: 50, // Welcome credit: 50 SMS
          subscriptionPlan: 'BASIC',
          isActive: false, // Pending Super Admin approval
        })
        .returning();

      // Assign the target user as CLINIC_ADMIN (pending activation)
      const [membership] = await tx
        .insert(clinicMembers)
        .values({
          clinicId: newClinic.id,
          userId: assignedAdminUserId,
          role: 'CLINIC_ADMIN',
          isActive: true,
        })
        .returning();

      this.logger.log(
        `Created clinic registration request "${newClinic.name}" (${newClinic.id}) for admin ${assignedAdminUserId} (Pending Approval)`,
      );

      return {
        clinic: newClinic,
        membership,
        message: 'Clinic registration submitted successfully. It is pending Super Admin approval.',
      };
    });
  }

  /**
   * Super Admin approves clinic: sets isActive = true and dispatches welcome SMS via BullMQ
   */
  async approveClinic(
    clinicId: string,
    _approvedByUserId: string,
  ): Promise<{ success: boolean; message: string; clinic: Clinic }> {
    const [clinic] = await this.db
      .select()
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    if (clinic.isActive) {
      return {
        success: true,
        message: `Clinic "${clinic.name}" is already active`,
        clinic,
      };
    }

    const [updatedClinic] = await this.db
      .update(clinics)
      .set({ isActive: true })
      .where(eq(clinics.id, clinicId))
      .returning();

    // Find the clinic admin to send approval SMS
    const [adminUser] = await this.db
      .select({
        phone: users.phone,
        fullName: users.fullName,
      })
      .from(clinicMembers)
      .innerJoin(users, eq(clinicMembers.userId, users.id))
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.role, 'CLINIC_ADMIN'),
        ),
      )
      .limit(1);

    if (adminUser?.phone) {
      await this.smsQueue.add('clinic-approval-notification', {
        phone: adminUser.phone,
        message: `Congratulations ${adminUser.fullName}! Your clinic "${updatedClinic.name}" has been approved. You can now manage your clinic.`,
        clinicId,
      });
      this.logger.log(`Enqueued clinic approval SMS to ${adminUser.phone} for clinic "${updatedClinic.name}"`);
    }

    return {
      success: true,
      message: `Clinic "${updatedClinic.name}" has been successfully approved and activated.`,
      clinic: updatedClinic,
    };
  }

  /**
   * List all clinics awaiting Super Admin approval
   */
  async getPendingClinics() {
    return this.db
      .select({
        clinicId: clinics.id,
        name: clinics.name,
        nameBn: clinics.nameBn,
        slug: clinics.slug,
        phone: clinics.phone,
        address: clinics.address,
        district: clinics.district,
        upazila: clinics.upazila,
        dghsRegNo: clinics.dghsRegNo,
        createdAt: clinics.createdAt,
        isActive: clinics.isActive,
      })
      .from(clinics)
      .where(eq(clinics.isActive, false));
  }

  /**
   * Assign a user as staff or doctor to an approved clinic via userId or phone number
   */
  async assignMember(
    clinicId: string,
    dto: AssignMemberDto,
    callerRole?: string,
  ): Promise<ClinicMember> {
    // Prevent privilege escalation: Only a SUPER_ADMIN can assign the SUPER_ADMIN role
    if (dto.role === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }

    const [clinic] = await this.db
      .select({ id: clinics.id, isActive: clinics.isActive })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    if (!clinic.isActive) {
      throw new ForbiddenException('Cannot manage staff for an inactive or pending clinic');
    }

    // Resolve target user by userId or phone
    let targetUserId = dto.userId;

    if (!targetUserId && !dto.phone) {
      throw new BadRequestException('Either userId or phone number must be provided to assign a member');
    }

    if (!targetUserId && dto.phone) {
      const cleanPhone = dto.phone.trim();
      const [userByPhone] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, cleanPhone))
        .limit(1);

      if (userByPhone) {
        targetUserId = userByPhone.id;
      } else {
        // Auto-provision user account for the staff member so clinic admin or super admin is never blocked
        const defaultName = dto.fullName?.trim() || `${dto.role.replace('_', ' ')} (${cleanPhone.slice(-4)})`;
        const passwordHash = dto.initialPassword
          ? await bcrypt.hash(dto.initialPassword, 10)
          : null;
        const [newUser] = await this.db
          .insert(users)
          .values({
            phone: cleanPhone,
            fullName: defaultName,
            passwordHash,
            isPhoneVerified: true,
            isActive: true,
          })
          .returning();
        targetUserId = newUser.id;
      }
    }

    const [targetUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId!))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundException(`User with ID "${targetUserId}" not found`);
    }

    // Check existing membership with same role
    const [existingMembership] = await this.db
      .select()
      .from(clinicMembers)
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.userId, targetUserId!),
          eq(clinicMembers.role, dto.role),
        ),
      )
      .limit(1);

    if (existingMembership) {
      if (!existingMembership.isActive) {
        const [reactivated] = await this.db
          .update(clinicMembers)
          .set({ isActive: true })
          .where(eq(clinicMembers.id, existingMembership.id))
          .returning();
        return reactivated;
      }
      throw new ConflictException(`User is already an active member of this clinic with role "${dto.role}"`);
    }

    const [membership] = await this.db
      .insert(clinicMembers)
      .values({
        clinicId,
        userId: targetUserId!,
        role: dto.role,
        isActive: true,
      })
      .returning();

    return membership;
  }

  /**
   * Get all clinics where the authenticated user is an active member
   */
  async getMyClinics(userId: string) {
    const records = await this.db
      .select({
        membershipId: clinicMembers.id,
        role: clinicMembers.role,
        membershipCreatedAt: clinicMembers.createdAt,
        clinicId: clinics.id,
        name: clinics.name,
        nameBn: clinics.nameBn,
        slug: clinics.slug,
        phone: clinics.phone,
        address: clinics.address,
        district: clinics.district,
        upazila: clinics.upazila,
        subscriptionPlan: clinics.subscriptionPlan,
        isActive: clinics.isActive,
      })
      .from(clinicMembers)
      .innerJoin(clinics, eq(clinicMembers.clinicId, clinics.id))
      .where(and(eq(clinicMembers.userId, userId), eq(clinicMembers.isActive, true)));

    return records;
  }

  /**
   * Get clinic tenant profile by ID
   */
  async getClinicById(clinicId: string): Promise<Clinic> {
    const [clinic] = await this.db
      .select()
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    return clinic;
  }

  /**
   * List members of a clinic with user details
   */
  async getClinicMembers(clinicId: string) {
    return this.db
      .select({
        id: clinicMembers.id,
        role: clinicMembers.role,
        isActive: clinicMembers.isActive,
        createdAt: clinicMembers.createdAt,
        user: {
          id: users.id,
          phone: users.phone,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(clinicMembers)
      .innerJoin(users, eq(clinicMembers.userId, users.id))
      .where(eq(clinicMembers.clinicId, clinicId));
  }
}
