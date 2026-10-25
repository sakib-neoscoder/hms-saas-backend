import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://clinic_user:clinic_password@localhost:5432/clinic_db',
  },
  verbose: true,
  strict: true,
});
