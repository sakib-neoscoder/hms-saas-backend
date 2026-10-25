import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
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
}
