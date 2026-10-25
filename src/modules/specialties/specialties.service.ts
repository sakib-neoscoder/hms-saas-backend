import {
  Injectable,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { specialties, Specialty } from '../../database/schema/specialties';
import { RedisService } from '../../providers/redis/redis.service';
import { CreateSpecialtyDto } from './dto';

export const SPECIALTIES_CACHE_KEY = 'cache:specialties';
export const SPECIALTIES_CACHE_TTL_SECONDS = 3600; // 1 hour

@Injectable()
export class SpecialtiesService {
  private readonly logger = new Logger(SpecialtiesService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Find all specialties ordered by English name, utilizing 1-hour Redis cache
   */
  async findAll(): Promise<Specialty[]> {
    const cached = await this.redisService.get(SPECIALTIES_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as Specialty[];
      } catch (err) {
        this.logger.warn('Failed to parse cached specialties JSON, querying database...', err);
      }
    }

    const results = await this.db
      .select()
      .from(specialties)
      .orderBy(asc(specialties.nameEn));

    // Cache results in Redis for 1 hour
    await this.redisService.set(
      SPECIALTIES_CACHE_KEY,
      JSON.stringify(results),
      SPECIALTIES_CACHE_TTL_SECONDS,
    );

    return results;
  }

  /**
   * Create a new medical specialty and invalidate the Redis cache
   */
  async create(dto: CreateSpecialtyDto): Promise<Specialty> {
    const cleanEn = dto.nameEn.trim();
    const cleanBn = dto.nameBn.trim();

    const [existing] = await this.db
      .select({ id: specialties.id })
      .from(specialties)
      .where(eq(specialties.nameEn, cleanEn))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Specialty "${cleanEn}" already exists`);
    }

    const [newSpecialty] = await this.db
      .insert(specialties)
      .values({
        nameEn: cleanEn,
        nameBn: cleanBn,
      })
      .returning();

    // Invalidate Redis cache
    await this.redisService.del(SPECIALTIES_CACHE_KEY);
    this.logger.log(`Created specialty "${cleanEn}" and invalidated Redis cache`);

    return newSpecialty;
  }
}
