import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const specialties = pgTable('specialties', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameEn: varchar('name_en', { length: 100 }).notNull().unique(),
  nameBn: varchar('name_bn', { length: 100 }).notNull(),
});

export type Specialty = typeof specialties.$inferSelect;
export type NewSpecialty = typeof specialties.$inferInsert;
