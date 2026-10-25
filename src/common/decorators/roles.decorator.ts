import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type ClinicRole =
  | 'SUPER_ADMIN'
  | 'CLINIC_ADMIN'
  | 'DOCTOR'
  | 'RECEPTIONIST'
  | 'ASSISTANT'
  | 'LAB_TECH';

export const Roles = (...roles: ClinicRole[]) => SetMetadata(ROLES_KEY, roles);
