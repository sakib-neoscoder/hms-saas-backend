import { Global, Module, OnApplicationShutdown, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export type DrizzleDB = NodePgDatabase<typeof schema>;

let activePool: Pool | null = null;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>('DATABASE_URL');
        const pool = new Pool({
          connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
          Logger.error('Unexpected error on idle PostgreSQL client', err.stack, 'DatabaseModule');
        });

        activePool = pool;
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  async onApplicationShutdown(signal?: string) {
    if (activePool) {
      this.logger.log(`Closing PostgreSQL connection pool (Signal: ${signal || 'none'})...`);
      await activePool.end();
      activePool = null;
    }
  }
}
