import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { clinics, clinicMembers, Clinic, ClinicMember } from '../../database/schema/clinics';
import { users } from '../../database/schema/users';
import { CreateClinicDto, AssignMemberDto } from './dto';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Create a new clinic tenant and automatically assign creator as SUPER_ADMIN
   */
  async createClinic(
    dto: CreateClinicDto,
    creatorUserId: string,
  ): Promise<{ clinic: Clinic; membership: ClinicMember }> {
    const cleanSlug = dto.slug.trim().toLowerCase();

    const [existing] = await this.db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.slug, cleanSlug))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Clinic slug "${cleanSlug}" is already taken`);
    }

    const [newClinic] = await this.db
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
        isActive: true,
      })
      .returning();

    // Assign the creator as SUPER_ADMIN
    const [membership] = await this.db
      .insert(clinicMembers)
      .values({
        clinicId: newClinic.id,
        userId: creatorUserId,
        role: 'SUPER_ADMIN',
        isActive: true,
      })
      .returning();

    this.logger.log(`Created new clinic "${newClinic.name}" (${newClinic.id}) by user ${creatorUserId}`);

    return { clinic: newClinic, membership };
  }

  /**
   * Assign a user to a specific clinic with a defined role
   */
  async assignMember(clinicId: string, dto: AssignMemberDto): Promise<ClinicMember> {
    const [clinic] = await this.db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    const [targetUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundException(`User with ID "${dto.userId}" not found`);
    }

    // Check existing membership with same role
    const [existingMembership] = await this.db
      .select()
      .from(clinicMembers)
      .where(
        and(
          eq(clinicMembers.clinicId, clinicId),
          eq(clinicMembers.userId, dto.userId),
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
        userId: dto.userId,
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
