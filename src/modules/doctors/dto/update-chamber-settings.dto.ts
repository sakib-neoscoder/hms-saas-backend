import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PadPrintSettingsDto } from './onboard-doctor.dto';

export class UpdateChamberSettingsDto {
  @ApiPropertyOptional({ example: 'Room 305, 3rd Floor', description: 'Updated chamber room number' })
  @IsString()
  @IsOptional()
  roomNo?: string;

  @ApiPropertyOptional({ example: 1200, description: 'Updated new patient consultation fee in BDT' })
  @IsInt()
  @Min(0)
  @IsOptional()
  newPatientFee?: number;

  @ApiPropertyOptional({ example: 700, description: 'Updated follow-up visit consultation fee in BDT' })
  @IsInt()
  @Min(0)
  @IsOptional()
  followupFee?: number;

  @ApiPropertyOptional({ example: 21, description: 'Updated follow-up validity window in days' })
  @IsInt()
  @Min(1)
  @IsOptional()
  followupValidityDays?: number;

  @ApiPropertyOptional({ example: 200, description: 'Updated report show fee in BDT' })
  @IsInt()
  @Min(0)
  @IsOptional()
  reportShowFee?: number;

  @ApiPropertyOptional({
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    description: 'Updated user UUID of assigned assistant',
  })
  @IsUUID()
  @IsOptional()
  assistantUserId?: string;

  @ApiPropertyOptional({
    description: 'Pad print settings',
    type: PadPrintSettingsDto,
  })
  @ValidateNested()
  @Type(() => PadPrintSettingsDto)
  @IsOptional()
  padPrintSettings?: PadPrintSettingsDto;

  @ApiPropertyOptional({ example: true, description: 'Set chamber active or inactive' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
