import { pgTable, uuid, varchar, integer, boolean, timestamp, text } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { invoices } from './invoices';
import { patients } from './patients';
import { appointments } from './appointments';
import { users } from './users';
import { labReportStatusEnum } from './enums';

export const clinicLabTests = pgTable('clinic_lab_tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id, { onDelete: 'cascade' }),
  testCode: varchar('test_code', { length: 30 }).notNull(),
  testName: varchar('test_name', { length: 200 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  price: integer('price').notNull(),
  sampleRoomNo: varchar('sample_room_no', { length: 50 }),
  deliveryTurnaroundHours: integer('delivery_turnaround_hours').default(24).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const labReports = pgTable('lab_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  testId: uuid('test_id').references(() => clinicLabTests.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  testName: varchar('test_name', { length: 200 }).notNull(),
  r2FileKey: text('r2_file_key'),
  status: labReportStatusEnum('status').default('SAMPLE_COLLECTED').notNull(),
  expectedDeliveryAt: timestamp('expected_delivery_at', { withTimezone: true }),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ClinicLabTest = typeof clinicLabTests.$inferSelect;
export type NewClinicLabTest = typeof clinicLabTests.$inferInsert;
export type LabReport = typeof labReports.$inferSelect;
export type NewLabReport = typeof labReports.$inferInsert;
