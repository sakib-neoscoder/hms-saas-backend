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
  ApiParam,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto, CreateScheduleExceptionDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantRoleGuard } from '../../common/guards/tenant-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Doctor Schedules & Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Active Clinic/Tenant UUID',
  })
  @ApiOperation({
    summary: 'Create or update weekly recurring shift schedule for a chamber',
    description:
      'Sets up or modifies shift consultation hours (e.g. SAT EVENING 17:00-21:00) and limits (max total serials and online quota).',
  })
  @ApiResponse({ status: 201, description: 'Schedule shift successfully created or updated' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g., online quota exceeds max limit)' })
  @ApiResponse({ status: 404, description: 'Chamber not found in the current clinic' })
  async createOrUpdateSchedule(
    @CurrentTenant() clinicId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulesService.createOrUpdateSchedule(clinicId, dto);
  }

  @Public()
  @Get('clinic-doctor/:clinicDoctorId')
  @ApiOperation({
    summary: 'Get active weekly shifts and upcoming exceptions for a chamber',
    description:
      'Public endpoint to retrieve the doctor chamber consultation timetable, consultation fees, and any cancellations or delayed start times.',
  })
  @ApiParam({ name: 'clinicDoctorId', description: 'Chamber UUID (clinicDoctors.id)' })
  @ApiResponse({ status: 200, description: 'Active shifts and schedule exceptions' })
  @ApiResponse({ status: 404, description: 'Chamber not found' })
  async getSchedulesByClinicDoctor(
    @Param('clinicDoctorId', ParseUUIDPipe) clinicDoctorId: string,
  ) {
    return this.schedulesService.getSchedulesByClinicDoctor(clinicDoctorId);
  }

  @Post('exceptions')
  @UseGuards(TenantRoleGuard)
  @Roles('SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST')
  @ApiHeader({
    name: 'x-clinic-id',
    required: true,
    description: 'Active Clinic/Tenant UUID',
  })
  @ApiOperation({
    summary: 'Add a chamber schedule exception (cancellation or delay)',
    description:
      'Records doctor absence or delayed start time for a specific date (e.g. emergency surgery, road block). Used by receptionists and doctors.',
  })
  @ApiResponse({ status: 201, description: 'Schedule exception created' })
  @ApiResponse({ status: 400, description: 'Invalid status or missing delayedStartTime' })
  @ApiResponse({ status: 404, description: 'Chamber not found in the active clinic' })
  async createScheduleException(
    @CurrentTenant() clinicId: string,
    @Body() dto: CreateScheduleExceptionDto,
  ) {
    return this.schedulesService.createScheduleException(clinicId, dto);
  }
}
