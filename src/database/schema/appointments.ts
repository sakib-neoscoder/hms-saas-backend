import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { doctors, doctorSchedules } from './doctors';
import { patients } from './patients';
import { users } from './users';
import { visitTypeEnum, bookingSourceEnum, appointmentStatusEnum } from './enums';

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => doctorSchedules.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    appointmentDate: date('appointment_date').notNull(),
    serialNumber: integer('serial_number').notNull(),
    visitType: visitTypeEnum('visit_type').notNull(),
    bookingSource: bookingSourceEnum('booking_source').notNull(),
    status: appointmentStatusEnum('status').notNull(),
    isVipOrEmergency: boolean('is_vip_or_emergency').default(false).notNull(),
    cancellationReason: text('cancellation_reason'),
    bookedByUserId: uuid('booked_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_appointments_clinic_schedule_date_serial').on(
      table.clinicId,
      table.scheduleId,
      table.appointmentDate,
      table.serialNumber,
    ),
    index('idx_appointments_clinic_date').on(table.clinicId, table.appointmentDate),
  ],
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
