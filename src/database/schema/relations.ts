import { relations } from 'drizzle-orm';
import { users } from './users';
import { clinics, clinicMembers } from './clinics';
import { specialties } from './specialties';
import {
  doctors,
  clinicDoctors,
  doctorSchedules,
  doctorScheduleExceptions,
} from './doctors';
import { patients } from './patients';
import { appointments } from './appointments';
import { prescriptions, prescriptionTemplates } from './prescriptions';
import { clinicLabTests, labReports } from './lab';
import { invoices, paymentTransactions } from './invoices';

export const usersRelations = relations(users, ({ many, one }) => ({
  clinicMemberships: many(clinicMembers),
  doctorProfile: one(doctors, {
    fields: [users.id],
    references: [doctors.userId],
  }),
  patients: many(patients),
  bookedAppointments: many(appointments, { relationName: 'bookedByUser' }),
  assistedClinicDoctors: many(clinicDoctors, { relationName: 'assistantUser' }),
  createdInvoices: many(invoices, { relationName: 'createdByUser' }),
  collectedPayments: many(paymentTransactions, { relationName: 'collectedByUser' }),
  uploadedLabReports: many(labReports, { relationName: 'uploadedByUser' }),
}));

export const clinicsRelations = relations(clinics, ({ many }) => ({
  members: many(clinicMembers),
  doctors: many(clinicDoctors),
  appointments: many(appointments),
  prescriptions: many(prescriptions),
  labTests: many(clinicLabTests),
  invoices: many(invoices),
  paymentTransactions: many(paymentTransactions),
  labReports: many(labReports),
}));

export const clinicMembersRelations = relations(clinicMembers, ({ one }) => ({
  clinic: one(clinics, {
    fields: [clinicMembers.clinicId],
    references: [clinics.id],
  }),
  user: one(users, {
    fields: [clinicMembers.userId],
    references: [users.id],
  }),
}));

export const specialtiesRelations = relations(specialties, ({ many }) => ({
  doctors: many(doctors),
}));

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  user: one(users, {
    fields: [doctors.userId],
    references: [users.id],
  }),
  specialty: one(specialties, {
    fields: [doctors.specialtyId],
    references: [specialties.id],
  }),
  clinicAssociations: many(clinicDoctors),
  appointments: many(appointments),
  prescriptions: many(prescriptions),
  templates: many(prescriptionTemplates),
  referredInvoices: many(invoices, { relationName: 'referredByDoctor' }),
}));

export const clinicDoctorsRelations = relations(clinicDoctors, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [clinicDoctors.clinicId],
    references: [clinics.id],
  }),
  doctor: one(doctors, {
    fields: [clinicDoctors.doctorId],
    references: [doctors.id],
  }),
  assistantUser: one(users, {
    fields: [clinicDoctors.assistantUserId],
    references: [users.id],
    relationName: 'assistantUser',
  }),
  schedules: many(doctorSchedules),
  exceptions: many(doctorScheduleExceptions),
}));

export const doctorSchedulesRelations = relations(doctorSchedules, ({ one, many }) => ({
  clinicDoctor: one(clinicDoctors, {
    fields: [doctorSchedules.clinicDoctorId],
    references: [clinicDoctors.id],
  }),
  appointments: many(appointments),
}));

export const doctorScheduleExceptionsRelations = relations(doctorScheduleExceptions, ({ one }) => ({
  clinicDoctor: one(clinicDoctors, {
    fields: [doctorScheduleExceptions.clinicDoctorId],
    references: [clinicDoctors.id],
  }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  primaryUser: one(users, {
    fields: [patients.primaryUserId],
    references: [users.id],
  }),
  appointments: many(appointments),
  prescriptions: many(prescriptions),
  invoices: many(invoices),
  labReports: many(labReports),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [appointments.clinicId],
    references: [clinics.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
  schedule: one(doctorSchedules, {
    fields: [appointments.scheduleId],
    references: [doctorSchedules.id],
  }),
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  bookedByUser: one(users, {
    fields: [appointments.bookedByUserId],
    references: [users.id],
    relationName: 'bookedByUser',
  }),
  prescription: one(prescriptions, {
    fields: [appointments.id],
    references: [prescriptions.appointmentId],
  }),
  invoices: many(invoices),
  labReports: many(labReports),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  appointment: one(appointments, {
    fields: [prescriptions.appointmentId],
    references: [appointments.id],
  }),
  clinic: one(clinics, {
    fields: [prescriptions.clinicId],
    references: [clinics.id],
  }),
  doctor: one(doctors, {
    fields: [prescriptions.doctorId],
    references: [doctors.id],
  }),
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
}));

export const prescriptionTemplatesRelations = relations(prescriptionTemplates, ({ one }) => ({
  doctor: one(doctors, {
    fields: [prescriptionTemplates.doctorId],
    references: [doctors.id],
  }),
}));

export const clinicLabTestsRelations = relations(clinicLabTests, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [clinicLabTests.clinicId],
    references: [clinics.id],
  }),
  labReports: many(labReports),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  clinic: one(clinics, {
    fields: [invoices.clinicId],
    references: [clinics.id],
  }),
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [invoices.appointmentId],
    references: [appointments.id],
  }),
  referredByDoctor: one(doctors, {
    fields: [invoices.referredByDoctorId],
    references: [doctors.id],
    relationName: 'referredByDoctor',
  }),
  createdByUser: one(users, {
    fields: [invoices.createdByUserId],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  transactions: many(paymentTransactions),
  labReports: many(labReports),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  clinic: one(clinics, {
    fields: [paymentTransactions.clinicId],
    references: [clinics.id],
  }),
  invoice: one(invoices, {
    fields: [paymentTransactions.invoiceId],
    references: [invoices.id],
  }),
  collectedByUser: one(users, {
    fields: [paymentTransactions.collectedByUserId],
    references: [users.id],
    relationName: 'collectedByUser',
  }),
}));

export const labReportsRelations = relations(labReports, ({ one }) => ({
  clinic: one(clinics, {
    fields: [labReports.clinicId],
    references: [clinics.id],
  }),
  invoice: one(invoices, {
    fields: [labReports.invoiceId],
    references: [invoices.id],
  }),
  test: one(clinicLabTests, {
    fields: [labReports.testId],
    references: [clinicLabTests.id],
  }),
  patient: one(patients, {
    fields: [labReports.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [labReports.appointmentId],
    references: [appointments.id],
  }),
  uploadedByUser: one(users, {
    fields: [labReports.uploadedByUserId],
    references: [users.id],
    relationName: 'uploadedByUser',
  }),
}));
