import { pgTable, uuid, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { appointments } from './appointments';
import { doctors } from './doctors';
import { users } from './users';
import { invoiceTypeEnum, paymentStatusEnum, paymentMethodEnum } from './enums';

export interface InvoiceItem {
  itemId?: string;
  name: string;
  price: number;
  quantity?: number;
  sampleRoom?: string;
}

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  referredByDoctorId: uuid('referred_by_doctor_id').references(() => doctors.id),
  invoiceNo: varchar('invoice_no', { length: 50 }).notNull().unique(),
  invoiceType: invoiceTypeEnum('invoice_type').notNull(),
  items: jsonb('items').$type<InvoiceItem[]>().notNull(),
  subTotal: integer('sub_total').notNull(),
  discountAmount: integer('discount_amount').default(0).notNull(),
  discountRemarks: varchar('discount_remarks', { length: 200 }),
  netPayable: integer('net_payable').notNull(),
  paidAmount: integer('paid_amount').default(0).notNull(),
  dueAmount: integer('due_amount').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  amount: integer('amount').notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  gatewayTrxId: varchar('gateway_trx_id', { length: 100 }),
  collectedByUserId: uuid('collected_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
