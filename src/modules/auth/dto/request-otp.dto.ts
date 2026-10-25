import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsBdPhoneNumber } from '../../../common/validators/bd-phone.validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '01812345678',
    description: 'Bangladeshi 11-digit mobile number for OTP dispatch',
  })
  @IsBdPhoneNumber()
  @IsNotEmpty()
  phone!: string;
}
