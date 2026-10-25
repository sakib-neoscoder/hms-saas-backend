import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      password: password && password.length > 0 ? password : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`, err.stack);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds && ttlSeconds > 0) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return this.client.expire(key, ttlSeconds);
  }

  /**
   * Acquire a distributed lock on a resource using Redis SET NX PX
   */
  async acquireLock(
    resourceKey: string,
    ttlMs = 5000,
  ): Promise<{ acquired: boolean; lockValue: string }> {
    const lockKey = `lock:${resourceKey}`;
    const lockValue = randomUUID();

    const result = await this.client.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
    const acquired = result === 'OK';

    return { acquired, lockValue };
  }

  /**
   * Safe atomic release of a distributed lock using Lua script to verify lock owner
   */
  async releaseLock(resourceKey: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${resourceKey}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const res = await this.client.eval(luaScript, 1, lockKey, lockValue);
    return res === 1;
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Disconnecting Redis client (Signal: ${signal || 'none'})...`);
    await this.client.quit();
  }
}
