import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IsBdPhoneNumber } from '../../../common/validators/bd-phone.validator';

export class RegisterUserDto {
  @ApiProperty({
    example: '01712345678',
    description: 'Bangladeshi 11-digit mobile number',
  })
  @IsBdPhoneNumber()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    example: 'Dr. Rafiqul Islam',
    description: 'Full name',
  })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    example: 'rafiqul@example.com',
    description: 'Optional email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
