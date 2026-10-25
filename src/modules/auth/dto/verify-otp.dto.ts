import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches, IsOptional } from 'class-validator';
import { IsBdPhoneNumber } from '../../../common/validators/bd-phone.validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: '01812345678',
    description: 'Bangladeshi 11-digit mobile number',
  })
  @IsBdPhoneNumber()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code received via SMS',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain numbers only' })
  @IsNotEmpty()
  otp!: string;

  @ApiPropertyOptional({
    example: 'Mohammad Rahim',
    description: 'Full name of the patient (used if registering for first time)',
  })
  @IsString()
  @IsOptional()
  fullName?: string;
}
