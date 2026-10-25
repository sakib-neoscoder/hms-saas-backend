import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { OnboardDoctorDto, UpdateChamberSettingsDto, FilterDoctorsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantRoleGuard } from '../../common/guards/tenant-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Doctors & Chambers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post('onboard')
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Active Clinic/Tenant UUID',
  })
  @ApiOperation({
    summary: 'Onboard a doctor and configure clinic chamber settings',
    description:
      'Transactionally creates or links the global doctor profile (BMDC, specialty, degrees, Rx header), assigns DOCTOR role in clinic_members, and sets up chamber consultation fees and room number.',
  })
  @ApiResponse({ status: 201, description: 'Doctor successfully onboarded to the clinic chamber' })
  @ApiResponse({ status: 400, description: 'Validation failed or clinic is inactive' })
  @ApiResponse({ status: 404, description: 'Clinic or specialty not found' })
  @ApiResponse({ status: 409, description: 'BMDC registration number is already registered to another user' })
  async onboardDoctor(
    @CurrentTenant() clinicId: string,
    @Body() dto: OnboardDoctorDto,
  ) {
    return this.doctorsService.onboardDoctor(clinicId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search and filter active doctors across clinics',
    description:
      'Public endpoint to filter doctors by clinic, specialty, or search keyword (name, BMDC, or designation). When clinicId is provided, chamber consultation fees and active schedules are included.',
  })
  @ApiResponse({ status: 200, description: 'List of doctors matching filter criteria' })
  async findAll(@Query() filter: FilterDoctorsDto) {
    return this.doctorsService.findAll(filter);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get comprehensive doctor profile across all clinics',
    description:
      'Public endpoint returning doctor details, degrees, BMDC registration, Rx headers, and all active clinic chambers with consultation schedules.',
  })
  @ApiParam({ name: 'id', description: 'Doctor UUID' })
  @ApiResponse({ status: 200, description: 'Comprehensive doctor profile with all practice chambers' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.doctorsService.findById(id);
  }

  @Patch(':doctorId/chamber-settings')
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Active Clinic/Tenant UUID',
  })
  @ApiOperation({
    summary: 'Update chamber consultation fees, room, assistant, or pad print margins',
    description:
      'Updates clinic chamber parameters for the specified doctor within the active clinic tenant.',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor UUID' })
  @ApiResponse({ status: 200, description: 'Chamber settings updated successfully' })
  @ApiResponse({ status: 404, description: 'Chamber mapping not found in this clinic' })
  async updateChamberSettings(
    @CurrentTenant() clinicId: string,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: UpdateChamberSettingsDto,
  ) {
    return this.doctorsService.updateChamberSettings(clinicId, doctorId, dto);
  }
}
