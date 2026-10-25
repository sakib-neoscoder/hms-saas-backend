import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  time,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { clinics } from './clinics';
import { specialties } from './specialties';
import { dayOfWeekEnum, shiftNameEnum, scheduleExceptionStatusEnum } from './enums';

export interface PadPrintSettings {
  isPreprintedPad: boolean;
  topMarginMm: number;
  leftMarginMm: number;
}

export const doctors = pgTable('doctors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  bmdcRegNo: varchar('bmdc_reg_no', { length: 50 }).notNull().unique(),
  specialtyId: uuid('specialty_id')
    .notNull()
    .references(() => specialties.id),
  degrees: text('degrees').notNull(),
  designation: varchar('designation', { length: 200 }),
  rxHeaderBn: text('rx_header_bn'),
  rxHeaderEn: text('rx_header_en'),
  signatureR2Key: text('signature_r2_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clinicDoctors = pgTable(
  'clinic_doctors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id, { onDelete: 'cascade' }),
    roomNo: varchar('room_no', { length: 50 }),
    newPatientFee: integer('new_patient_fee').notNull(),
    followupFee: integer('followup_fee').notNull(),
    followupValidityDays: integer('followup_validity_days').default(30).notNull(),
    reportShowFee: integer('report_show_fee').default(0).notNull(),
    assistantUserId: uuid('assistant_user_id').references(() => users.id),
    padPrintSettings: jsonb('pad_print_settings').$type<PadPrintSettings>(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    uniqueIndex('idx_clinic_doctors_clinic_doctor').on(table.clinicId, table.doctorId),
  ],
);

export const doctorSchedules = pgTable('doctor_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicDoctorId: uuid('clinic_doctor_id')
    .notNull()
    .references(() => clinicDoctors.id, { onDelete: 'cascade' }),
  dayOfWeek: dayOfWeekEnum('day_of_week').notNull(),
  shiftName: shiftNameEnum('shift_name').default('EVENING').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  maxSerialLimit: integer('max_serial_limit').default(40).notNull(),
  onlineBookingLimit: integer('online_booking_limit').default(15).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const doctorScheduleExceptions = pgTable('doctor_schedule_exceptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicDoctorId: uuid('clinic_doctor_id')
    .notNull()
    .references(() => clinicDoctors.id, { onDelete: 'cascade' }),
  exceptionDate: date('exception_date').notNull(),
  status: scheduleExceptionStatusEnum('status').notNull(),
  delayedStartTime: time('delayed_start_time'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type ClinicDoctor = typeof clinicDoctors.$inferSelect;
export type NewClinicDoctor = typeof clinicDoctors.$inferInsert;
export type DoctorSchedule = typeof doctorSchedules.$inferSelect;
export type NewDoctorSchedule = typeof doctorSchedules.$inferInsert;
export type DoctorScheduleException = typeof doctorScheduleExceptions.$inferSelect;
export type NewDoctorScheduleException = typeof doctorScheduleExceptions.$inferInsert;
