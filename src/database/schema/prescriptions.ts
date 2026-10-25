import { pgTable, uuid, varchar, text, timestamp, date, jsonb } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { doctors } from './doctors';
import { patients } from './patients';
import { appointments } from './appointments';

export interface VitalsData {
  bp?: string;
  weightKg?: number;
  pulse?: number;
  tempF?: number;
  spo2?: number;
  rbs?: number;
}

export interface PrescribedMedicineItem {
  medicineId?: string;
  brandName: string;
  dose: string; // e.g. "১+০+১"
  timing: string; // e.g. "ভরা পেটে"
  duration: string; // e.g. "৭ দিন"
  note?: string;
}

export interface AdvisedLabTestItem {
  testId?: string;
  testName: string;
  note?: string;
}

export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  doctorId: uuid('doctor_id')
    .notNull()
    .references(() => doctors.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  vitals: jsonb('vitals').$type<VitalsData>(),
  chiefComplaints: jsonb('chief_complaints').$type<string[]>(),
  medicalHistory: jsonb('medical_history').$type<string[]>(),
  onExamination: jsonb('on_examination').$type<string[]>(),
  diagnosis: text('diagnosis'),
  medicinesPrescribed: jsonb('medicines_prescribed')
    .$type<PrescribedMedicineItem[]>()
    .notNull(),
  labTestsAdvised: jsonb('lab_tests_advised').$type<AdvisedLabTestItem[]>(),
  adviceBn: text('advice_bn'),
  nextVisitDate: date('next_visit_date'),
  pdfR2Key: text('pdf_r2_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptionTemplates = pgTable('prescription_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id')
    .notNull()
    .references(() => doctors.id, { onDelete: 'cascade' }),
  templateName: varchar('template_name', { length: 100 }).notNull(),
  diagnosis: text('diagnosis'),
  medicinesPrescribed: jsonb('medicines_prescribed')
    .$type<PrescribedMedicineItem[]>()
    .notNull(),
  labTestsAdvised: jsonb('lab_tests_advised').$type<AdvisedLabTestItem[]>(),
  adviceBn: text('advice_bn'),
});

export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;
export type PrescriptionTemplate = typeof prescriptionTemplates.$inferSelect;
export type NewPrescriptionTemplate = typeof prescriptionTemplates.$inferInsert;
