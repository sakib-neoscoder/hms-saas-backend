import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DRIZZLE_DB, DrizzleDB } from '../../database/database.module';
import { users, User } from '../../database/schema/users';
import { RedisService } from '../../providers/redis/redis.service';
import { QUEUES, SendSmsJobData } from '../../providers/queues/queue.constants';
import {
  LoginPasswordDto,
  RequestOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  RegisterUserDto,
} from './dto';
import { JwtPayload } from './jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SanitizedUser {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  isPhoneVerified: boolean;
  isActive: boolean;
  avatarR2Key: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUES.SMS) private readonly smsQueue: Queue<SendSmsJobData>,
  ) {}

  /**
   * Register a new user with phone & password (for Doctors, Admins, Receptionists, Staff)
   */
  async register(dto: RegisterUserDto): Promise<{ user: SanitizedUser } & AuthTokens> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, dto.phone.trim()))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Phone number ${dto.phone} is already registered`);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const [newUser] = await this.db
      .insert(users)
      .values({
        phone: dto.phone.trim(),
        fullName: dto.fullName.trim(),
        email: dto.email ? dto.email.trim().toLowerCase() : null,
        passwordHash,
        isPhoneVerified: false,
        isActive: true,
      })
      .returning();

    const tokens = await this.generateAndStoreTokens(newUser);
    return {
      user: this.sanitizeUser(newUser),
      ...tokens,
    };
  }

  /**
   * Staff/Doctor password-based authentication
   */
  async loginWithPassword(dto: LoginPasswordDto): Promise<{ user: SanitizedUser } & AuthTokens> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, dto.phone.trim()))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    // Update lastLoginAt
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const tokens = await this.generateAndStoreTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Patient OTP Login: Generate a 6-digit OTP, store in Redis with 3-minute TTL (180s), and dispatch via BullMQ
   */
  async requestOtp(dto: RequestOtpDto): Promise<{
    message: string;
    expiresInSeconds: number;
    devOtp?: string;
  }> {
    const cleanPhone = dto.phone.trim();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const ttlSeconds = 180; // 3 minutes

    const redisKey = `otp:${cleanPhone}`;
    await this.redisService.set(redisKey, otp, ttlSeconds);

    // Enqueue SMS job to BullMQ
    await this.smsQueue.add('send-otp', {
      phone: cleanPhone,
      message: `Your verification code is ${otp}. Valid for 3 minutes.`,
    });

    this.logger.log(`Generated OTP for ${cleanPhone} (TTL: ${ttlSeconds}s)`);

    const isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';

    return {
      message: 'OTP has been dispatched to your phone number',
      expiresInSeconds: ttlSeconds,
      ...(isDevelopment ? { devOtp: otp } : {}),
    };
  }

  /**
   * Verify patient OTP, register on-the-fly if new, and issue JWT tokens
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ user: SanitizedUser; isNewUser: boolean } & AuthTokens> {
    const cleanPhone = dto.phone.trim();
    const redisKey = `otp:${cleanPhone}`;
    const storedOtp = await this.redisService.get(redisKey);

    if (!storedOtp || storedOtp !== dto.otp.trim()) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    // Single-use OTP: remove from Redis immediately
    await this.redisService.del(redisKey);

    let [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, cleanPhone))
      .limit(1);

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const defaultName = dto.fullName?.trim() || `Patient ${cleanPhone.slice(-4)}`;
      [user] = await this.db
        .insert(users)
        .values({
          phone: cleanPhone,
          fullName: defaultName,
          isPhoneVerified: true,
          isActive: true,
          lastLoginAt: new Date(),
        })
        .returning();
    } else {
      await this.db
        .update(users)
        .set({
          isPhoneVerified: true,
          lastLoginAt: new Date(),
          ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        })
        .where(eq(users.id, user.id));
    }

    const tokens = await this.generateAndStoreTokens(user);
    return {
      user: this.sanitizeUser(user),
      isNewUser,
      ...tokens,
    };
  }

  /**
   * Issue new Access Token and rotated Refresh Token using valid Refresh Token
   */
  async refreshTokens(dto: RefreshTokenDto): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const redisKey = `refresh_token:${payload.sub}`;
    const storedHash = await this.redisService.get(redisKey);

    if (!storedHash) {
      throw new UnauthorizedException('Refresh token was revoked or has expired');
    }

    const isMatch = await bcrypt.compare(dto.refreshToken, storedHash);
    if (!isMatch) {
      // Possible token reuse attack: purge stored token
      await this.redisService.del(redisKey);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is deactivated or does not exist');
    }

    return this.generateAndStoreTokens(user);
  }

  /**
   * Invalidate user's refresh token on logout
   */
  async logout(userId: string): Promise<{ success: boolean; message: string }> {
    const redisKey = `refresh_token:${userId}`;
    await this.redisService.del(redisKey);
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Helper: Generate access + refresh tokens and store refresh token hash in Redis
   */
  private async generateAndStoreTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiration = this.configService.get<string>('JWT_ACCESS_EXPIRATION_TIME', '15m');
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiration as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiration as any,
      }),
    ]);

    // Compute TTL for Redis storage (7 days = 604800 seconds)
    const refreshTtlSeconds = 7 * 24 * 60 * 60;
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const redisKey = `refresh_token:${user.id}`;
    await this.redisService.set(redisKey, refreshTokenHash, refreshTtlSeconds);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiration,
    };
  }

  private sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      isPhoneVerified: user.isPhoneVerified,
      isActive: user.isActive,
      avatarR2Key: user.avatarR2Key,
    };
  }
}
