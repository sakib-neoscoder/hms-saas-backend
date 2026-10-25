import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto, AssignMemberDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantRoleGuard } from '../../common/guards/tenant-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Clinics (Tenants)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new clinic tenant (creator becomes SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Clinic tenant created successfully' })
  @ApiResponse({ status: 409, description: 'Clinic slug already exists' })
  async createClinic(
    @Body() dto: CreateClinicDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clinicsService.createClinic(dto, userId);
  }

  @Get('my-clinics')
  @ApiOperation({ summary: 'Get all clinics the authenticated user belongs to' })
  @ApiResponse({ status: 200, description: 'List of clinics and user roles' })
  async getMyClinics(@CurrentUser('id') userId: string) {
    return this.clinicsService.getMyClinics(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinic tenant profile by ID' })
  @ApiResponse({ status: 200, description: 'Clinic details' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async getClinicById(@Param('id', ParseUUIDPipe) id: string) {
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
  @ApiOperation({ summary: 'Assign a user as staff/doctor member in this clinic (Requires SUPER_ADMIN or CLINIC_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Member assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient tenant permissions' })
  async assignMember(
    @Param('id', ParseUUIDPipe) clinicId: string,
    @Body() dto: AssignMemberDto,
  ) {
    return this.clinicsService.assignMember(clinicId, dto);
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
  async getClinicMembers(@Param('id', ParseUUIDPipe) clinicId: string) {
    return this.clinicsService.getClinicMembers(clinicId);
  }
}
