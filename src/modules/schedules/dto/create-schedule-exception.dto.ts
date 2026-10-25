import {
  IsUUID,
  IsEnum,
  IsString,
  IsDateString,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ScheduleExceptionStatus {
  CANCELLED = 'CANCELLED',
  DELAYED = 'DELAYED',
}

export class CreateScheduleExceptionDto {
  @ApiProperty({
    description: 'Chamber / Clinic Doctor UUID',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @IsUUID('4', { message: 'clinicDoctorId must be a valid UUID' })
  clinicDoctorId!: string;

  @ApiProperty({
    description: 'Exception date in YYYY-MM-DD format',
    example: '2026-11-01',
  })
  @IsDateString({}, { message: 'exceptionDate must be a valid ISO date string (YYYY-MM-DD)' })
  exceptionDate!: string;

  @ApiProperty({
    enum: ScheduleExceptionStatus,
    description: 'Exception status: CANCELLED or DELAYED',
    example: 'CANCELLED',
  })
  @IsEnum(ScheduleExceptionStatus, {
    message: 'status must be either CANCELLED or DELAYED',
  })
  status!: ScheduleExceptionStatus;

  @ApiPropertyOptional({
    description: 'New start time if status is DELAYED (HH:mm or HH:mm:ss)',
    example: '18:30',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'delayedStartTime must be a valid 24h time in HH:mm or HH:mm:ss format',
  })
  delayedStartTime?: string;

  @ApiPropertyOptional({
    description: 'Reason for chamber delay or cancellation (e.g. emergency surgery, traffic)',
    example: 'Doctor is delayed due to an emergency surgery at Medical College Hospital',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
