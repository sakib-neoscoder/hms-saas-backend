import {
  IsUUID,
  IsEnum,
  IsString,
  Matches,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DayOfWeek {
  SAT = 'SAT',
  SUN = 'SUN',
  MON = 'MON',
  TUE = 'TUE',
  WED = 'WED',
  THU = 'THU',
  FRI = 'FRI',
}

export enum ShiftName {
  MORNING = 'MORNING',
  EVENING = 'EVENING',
}

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Chamber / Clinic Doctor UUID',
    example: 'a0000000-0000-0000-0000-000000000001',
  })
  @IsUUID('4', { message: 'clinicDoctorId must be a valid UUID' })
  clinicDoctorId!: string;

  @ApiProperty({
    enum: DayOfWeek,
    description: 'Day of week (SAT, SUN, MON, TUE, WED, THU, FRI)',
    example: 'SAT',
  })
  @IsEnum(DayOfWeek, {
    message: 'dayOfWeek must be one of: SAT, SUN, MON, TUE, WED, THU, FRI',
  })
  dayOfWeek!: DayOfWeek;

  @ApiProperty({
    enum: ShiftName,
    description: 'Shift name (MORNING or EVENING)',
    example: 'EVENING',
    default: 'EVENING',
  })
  @IsEnum(ShiftName, { message: 'shiftName must be MORNING or EVENING' })
  shiftName!: ShiftName;

  @ApiProperty({
    description: 'Shift start time in 24h format (HH:mm or HH:mm:ss)',
    example: '17:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'startTime must be a valid 24h time in HH:mm or HH:mm:ss format',
  })
  startTime!: string;

  @ApiProperty({
    description: 'Shift end time in 24h format (HH:mm or HH:mm:ss)',
    example: '21:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'endTime must be a valid 24h time in HH:mm or HH:mm:ss format',
  })
  endTime!: string;

  @ApiPropertyOptional({
    description: 'Maximum total patients for this shift',
    example: 40,
    default: 40,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxSerialLimit?: number;

  @ApiPropertyOptional({
    description: 'Maximum online booking quota for this shift',
    example: 15,
    default: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  onlineBookingLimit?: number;

  @ApiPropertyOptional({
    description: 'Whether this schedule slot is currently active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
