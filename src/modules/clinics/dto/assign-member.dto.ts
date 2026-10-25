import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ClinicRole } from '../../../common/decorators/roles.decorator';
import { IsBdPhoneNumber } from '../../../common/validators/bd-phone.validator';

export class AssignMemberDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'UUID of the registered user to add to the clinic (provide userId or phone)',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    example: '01712345678',
    description: '11-digit Bangladeshi mobile number of user (auto-provisions user if not registered)',
  })
  @IsBdPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'Md. Shofiqul Islam',
    description: 'Full name of the staff/member (used when auto-provisioning a new user)',
  })
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Staff@1234',
    description: 'Initial password so the member can log in directly without waiting for OTP',
  })
  @IsOptional()
  initialPassword?: string;

  @ApiProperty({
    example: 'DOCTOR',
    enum: ['SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT', 'LAB_TECH'],
    description: 'Role of the member within this clinic tenant',
  })
  @IsEnum(
    ['SUPER_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT', 'LAB_TECH'],
    { message: 'Role must be one of: SUPER_ADMIN, CLINIC_ADMIN, DOCTOR, RECEPTIONIST, ASSISTANT, LAB_TECH' },
  )
  @IsNotEmpty()
  role!: ClinicRole;
}
