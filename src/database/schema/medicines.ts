import { pgTable, uuid, varchar, index } from 'drizzle-orm/pg-core';

export const medicines = pgTable(
  'medicines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandName: varchar('brand_name', { length: 150 }).notNull(),
    genericName: varchar('generic_name', { length: 200 }).notNull(),
    strength: varchar('strength', { length: 100 }).notNull(),
    dosageForm: varchar('dosage_form', { length: 50 }).notNull(),
    manufacturer: varchar('manufacturer', { length: 150 }),
  },
  (table) => [
    index('idx_medicines_brand_name').on(table.brandName),
    index('idx_medicines_generic_name').on(table.genericName),
  ],
);

export type Medicine = typeof medicines.$inferSelect;
export type NewMedicine = typeof medicines.$inferInsert;
