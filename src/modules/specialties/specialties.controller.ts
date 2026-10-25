import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SpecialtiesService } from './specialties.service';
import { CreateSpecialtyDto } from './dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@ApiTags('Medical Specialties')
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all medical specialties (Cached in Redis for 1 hour)' })
  @ApiResponse({ status: 200, description: 'List of all specialties ordered by English name' })
  async findAll() {
    return this.specialtiesService.findAll();
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new medical specialty (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Specialty created successfully' })
  @ApiResponse({ status: 409, description: 'Specialty already exists' })
  async create(@Body() dto: CreateSpecialtyDto) {
    return this.specialtiesService.create(dto);
  }
}
