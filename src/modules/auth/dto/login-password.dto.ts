import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsBdPhoneNumber } from '../../../common/validators/bd-phone.validator';

export class LoginPasswordDto {
  @ApiProperty({
    example: '01712345678',
    description: 'Bangladeshi 11-digit mobile number',
  })
  @IsBdPhoneNumber()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Account password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @IsNotEmpty()
  password!: string;
}
