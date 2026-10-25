import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterDoctorsDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Filter doctors practicing at a specific clinic tenant',
  })
  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @ApiPropertyOptional({
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    description: 'Filter doctors by medical specialty UUID',
  })
  @IsUUID()
  @IsOptional()
  specialtyId?: string;

  @ApiPropertyOptional({
    enum: ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'],
    example: 'SAT',
    description: 'Filter doctors who have active chamber shifts on this day of week',
  })
  @IsOptional()
  dayOfWeek?: 'SAT' | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';

  @ApiPropertyOptional({
    example: 'Rahim',
    description: 'Text search by doctor full name, BMDC registration number, or designation',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
