import { pgTable, uuid, varchar, text, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { clinicMemberRoleEnum } from './enums';

export const clinics = pgTable('clinics', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  nameBn: varchar('name_bn', { length: 200 }),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  logoR2Key: text('logo_r2_key'),
  phone: varchar('phone', { length: 20 }).notNull(),
  address: text('address').notNull(),
  district: varchar('district', { length: 50 }).notNull(),
  upazila: varchar('upazila', { length: 50 }),
  dghsRegNo: varchar('dghs_reg_no', { length: 100 }),
  smsSenderId: varchar('sms_sender_id', { length: 20 }),
  smsBalance: integer('sms_balance').default(0).notNull(),
  subscriptionPlan: varchar('subscription_plan', { length: 50 }).default('BASIC').notNull(),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clinicMembers = pgTable(
  'clinic_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: clinicMemberRoleEnum('role').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_clinic_members_clinic_user_role').on(table.clinicId, table.userId, table.role),
  ],
);

export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;
export type ClinicMember = typeof clinicMembers.$inferSelect;
export type NewClinicMember = typeof clinicMembers.$inferInsert;
