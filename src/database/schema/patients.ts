import { pgTable, uuid, varchar, integer, timestamp, date, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    primaryUserId: uuid('primary_user_id').references(() => users.id),
    patientCode: varchar('patient_code', { length: 30 }).notNull().unique(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    guardianName: varchar('guardian_name', { length: 150 }),
    phone: varchar('phone', { length: 15 }).notNull(),
    ageYears: integer('age_years').notNull(),
    ageMonths: integer('age_months').default(0).notNull(),
    dateOfBirth: date('date_of_birth'),
    gender: varchar('gender', { length: 20 }).notNull(),
    bloodGroup: varchar('blood_group', { length: 10 }),
    address: varchar('address', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_patients_phone').on(table.phone),
  ],
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
