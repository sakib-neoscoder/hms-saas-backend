import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsBdPhoneNumber } from '../../../common/validators/bd-phone.validator';

export class PadPrintSettingsDto {
  @ApiProperty({ example: true, description: 'True if clinic uses pre-printed pad with logos' })
  @IsBoolean()
  isPreprintedPad!: boolean;

  @ApiProperty({ example: 45, description: 'Top margin in millimeters' })
  @IsNumber()
  @Min(0)
  topMarginMm!: number;

  @ApiProperty({ example: 60, description: 'Left margin in millimeters' })
  @IsNumber()
  @Min(0)
  leftMarginMm!: number;
}

export class OnboardDoctorDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Existing user UUID for doctor account (optional if phone provided)',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: '01711223344',
    description: 'Bangladeshi phone number of the doctor (will link or auto-create account)',
  })
  @IsBdPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'Prof. Dr. M. A. Rahim',
    description: 'Doctor full name (required if new user account is being created)',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'dr.rahim@example.com',
    description: 'Doctor email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'A-45678',
    description: 'Mandatory BMDC Medical Registration Number',
  })
  @IsString()
  @IsNotEmpty()
  bmdcRegNo!: string;

  @ApiProperty({
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    description: 'UUID of the medical specialty (from /api/specialties)',
  })
  @IsUUID()
  @IsNotEmpty()
  specialtyId!: string;

  @ApiProperty({
    example: 'MBBS (DMC), FCPS (Medicine), MD (Cardiology)',
    description: 'Academic and professional degrees',
  })
  @IsString()
  @IsNotEmpty()
  degrees!: string;

  @ApiPropertyOptional({
    example: 'Associate Professor, Department of Cardiology, DMC',
    description: 'Official clinical or academic designation',
  })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional({
    example: 'মেডিসিন ও হৃদরোগ বিশেষজ্ঞ',
    description: 'Bangla header text for printed prescriptions',
  })
  @IsString()
  @IsOptional()
  rxHeaderBn?: string;

  @ApiPropertyOptional({
    example: 'Consultant Cardiologist & Physician',
    description: 'English header text for printed prescriptions',
  })
  @IsString()
  @IsOptional()
  rxHeaderEn?: string;

  @ApiPropertyOptional({
    example: 'doctors/signatures/sig_rahim.png',
    description: 'Cloudflare R2 key for digital signature image',
  })
  @IsString()
  @IsOptional()
  signatureR2Key?: string;

  @ApiPropertyOptional({
    example: 'Room 304, 3rd Floor',
    description: 'Chamber Room Number in this clinic',
  })
  @IsString()
  @IsOptional()
  roomNo?: string;

  @ApiProperty({
    example: 1000,
    description: 'Consultation fee for first-time / new patient in BDT',
  })
  @IsInt()
  @Min(0)
  newPatientFee!: number;

  @ApiProperty({
    example: 600,
    description: 'Consultation fee for follow-up visit in BDT',
  })
  @IsInt()
  @Min(0)
  followupFee!: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Follow-up validity window in days (default: 30)',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  followupValidityDays?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Fee for report-showing visit only in BDT (default: 0)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  reportShowFee?: number;

  @ApiPropertyOptional({
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    description: 'User UUID of the assigned assistant / compounder for this chamber',
  })
  @IsUUID()
  @IsOptional()
  assistantUserId?: string;

  @ApiPropertyOptional({
    description: 'Pad print settings (margins in mm and preprinted flag)',
    type: PadPrintSettingsDto,
  })
  @ValidateNested()
  @Type(() => PadPrintSettingsDto)
  @IsOptional()
  padPrintSettings?: PadPrintSettingsDto;
}
