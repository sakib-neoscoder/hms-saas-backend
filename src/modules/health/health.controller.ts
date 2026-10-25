import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { RedisService } from '../../providers/redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'System health check (PostgreSQL 16 & Redis 7 status)' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  async check() {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';

    try {
      await this.db.execute(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    try {
      const pingResult = await this.redisService.getClient().ping();
      redisStatus = pingResult === 'PONG' ? 'connected' : 'error';
    } catch {
      redisStatus = 'error';
    }

    const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
