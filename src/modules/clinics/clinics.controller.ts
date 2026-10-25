import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto, AssignMemberDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantRoleGuard } from '../../common/guards/tenant-role.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ClinicMember } from '../../database/schema/clinics';

@ApiTags('Clinics (Tenants)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a new clinic registration request (Creator becomes CLINIC_ADMIN, pending approval)',
  })
  @ApiResponse({ status: 201, description: 'Clinic registration submitted (isActive: false)' })
  @ApiResponse({ status: 409, description: 'Clinic slug already exists' })
  async createClinic(
    @Body() dto: CreateClinicDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clinicsService.createClinic(dto, userId);
  }

  @Get('pending')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List all clinics awaiting Super Admin approval (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'List of unapproved clinics' })
  async getPendingClinics() {
    return this.clinicsService.getPendingClinics();
  }

  @Patch(':id/approve')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Approve a pending clinic and dispatch welcome SMS (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic approved and activated' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async approveClinic(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.clinicsService.approveClinic(id, userId);
  }

  @Get('my-clinics')
  @ApiOperation({ summary: 'Get all clinics the authenticated user belongs to' })
  @ApiResponse({ status: 200, description: 'List of clinics and user roles' })
  async getMyClinics(@CurrentUser('id') userId: string) {
    return this.clinicsService.getMyClinics(userId);
  }

  @Get(':id')
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT', 'LAB_TECH')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Target Clinic Tenant UUID',
  })
  @ApiOperation({ summary: 'Get clinic tenant profile by ID (Tenant members only)' })
  @ApiResponse({ status: 200, description: 'Clinic details' })
  @ApiResponse({ status: 403, description: 'Forbidden: Route clinic ID does not match x-clinic-id header or inactive tenant' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async getClinicById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() headerClinicId: string,
  ) {
    if (id !== headerClinicId) {
      throw new ForbiddenException('Route clinic ID does not match x-clinic-id header');
    }
    return this.clinicsService.getClinicById(id);
  }

  @Post(':id/members')
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Target Clinic Tenant UUID',
  })
  @ApiOperation({
    summary: 'Assign a user as staff/doctor member in this clinic via userId or phone number',
  })
  @ApiResponse({ status: 201, description: 'Member assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Route clinic ID mismatch or insufficient tenant permissions' })
  async assignMember(
    @Param('id', ParseUUIDPipe) clinicId: string,
    @CurrentTenant() headerClinicId: string,
    @Body() dto: AssignMemberDto,
    @Req() req: Request & { tenantMembership?: ClinicMember },
  ) {
    if (clinicId !== headerClinicId) {
      throw new ForbiddenException('Route clinic ID does not match x-clinic-id header');
    }
    const callerRole = req.tenantMembership?.role;
    return this.clinicsService.assignMember(clinicId, dto, callerRole);
  }

  @Get(':id/members')
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Target Clinic Tenant UUID',
  })
  @ApiOperation({ summary: 'List all staff & doctor members in this clinic' })
  @ApiResponse({ status: 200, description: 'List of clinic members' })
  @ApiResponse({ status: 403, description: 'Forbidden: Route clinic ID mismatch or insufficient tenant permissions' })
  async getClinicMembers(
    @Param('id', ParseUUIDPipe) clinicId: string,
    @CurrentTenant() headerClinicId: string,
  ) {
    if (clinicId !== headerClinicId) {
      throw new ForbiddenException('Route clinic ID does not match x-clinic-id header');
    }
    return this.clinicsService.getClinicMembers(clinicId);
  }
}
