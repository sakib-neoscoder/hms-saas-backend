import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { ClinicRole } from '../../../common/decorators/roles.decorator';

export class AssignMemberDto {
  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'UUID of the registered user to add to the clinic',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

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
