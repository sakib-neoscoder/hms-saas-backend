import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
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
  UpdateProfileDto,
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

/**
 * Parses duration strings like '7d', '24h', '60m', '3600s', or raw numeric strings into seconds
 */
export function parseDurationToSeconds(duration: string): number {
  const trimmed = duration.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60; // fallback to 7 days
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 7 * 24 * 60 * 60;
  }
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
    const cleanPhone = dto.phone.trim();
    const cleanEmail = dto.email ? dto.email.trim().toLowerCase() : null;

    // Check duplicate phone
    const [existingPhone] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, cleanPhone))
      .limit(1);

    if (existingPhone) {
      throw new ConflictException(`Phone number ${cleanPhone} is already registered`);
    }

    // Check duplicate email if provided
    if (cleanEmail) {
      const [existingEmail] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);

      if (existingEmail) {
        throw new ConflictException('Email address is already registered');
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    try {
      const [newUser] = await this.db
        .insert(users)
        .values({
          phone: cleanPhone,
          fullName: dto.fullName.trim(),
          email: cleanEmail,
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
    } catch (error: any) {
      if (error?.code === '23505') {
        const detail = error?.detail || error?.message || '';
        if (detail.includes('email')) {
          throw new ConflictException('Email address is already registered');
        }
        if (detail.includes('phone')) {
          throw new ConflictException(`Phone number ${cleanPhone} is already registered`);
        }
        throw new ConflictException('A user with these unique credentials already exists');
      }
      throw error;
    }
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
   * Patient OTP Login: Generate a 6-digit OTP, enforce 60s cooldown, store in Redis with 3-minute TTL (180s)
   */
  async requestOtp(dto: RequestOtpDto): Promise<{
    message: string;
    expiresInSeconds: number;
    devOtp?: string;
  }> {
    const cleanPhone = dto.phone.trim();
    const cooldownKey = `otp_cooldown:${cleanPhone}`;

    // Enforce 60-second cooldown between OTP requests
    const inCooldown = await this.redisService.exists(cooldownKey);
    if (inCooldown) {
      throw new BadRequestException('Please wait 60 seconds before requesting a new OTP');
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const ttlSeconds = 180; // 3 minutes

    const redisKey = `otp:${cleanPhone}`;
    const attemptsKey = `otp_attempts:${cleanPhone}`;

    await this.redisService.set(redisKey, otp, ttlSeconds);
    await this.redisService.set(cooldownKey, '1', 60);
    // Reset previous attempt counter for the newly generated OTP
    await this.redisService.del(attemptsKey);

    // Enqueue SMS job to BullMQ
    await this.smsQueue.add('send-otp', {
      phone: cleanPhone,
      message: `Your verification code is ${otp}. Valid for 3 minutes.`,
    });

    this.logger.log(`Generated OTP for ${cleanPhone} (TTL: ${ttlSeconds}s, Cooldown: 60s)`);

    const isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';

    return {
      message: 'OTP has been dispatched to your phone number',
      expiresInSeconds: ttlSeconds,
      ...(isDevelopment ? { devOtp: otp } : {}),
    };
  }

  /**
   * Verify patient OTP with brute-force attempt protection (Max 5 attempts), register if new, and issue JWT tokens
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ user: SanitizedUser; isNewUser: boolean } & AuthTokens> {
    const cleanPhone = dto.phone.trim();
    const redisKey = `otp:${cleanPhone}`;
    const attemptsKey = `otp_attempts:${cleanPhone}`;

    const storedOtp = await this.redisService.get(redisKey);
    if (!storedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    if (storedOtp !== dto.otp.trim()) {
      const attempts = await this.redisService.incr(attemptsKey);
      if (attempts === 1) {
        await this.redisService.expire(attemptsKey, 180);
      }

      if (attempts >= 5) {
        // Brute-force lockout: Invalidate OTP and attempts immediately
        await this.redisService.del(redisKey);
        await this.redisService.del(attemptsKey);
        throw new UnauthorizedException('Too many failed OTP attempts. Please request a new OTP.');
      }

      const remaining = 5 - attempts;
      throw new UnauthorizedException(`Invalid OTP code. ${remaining} attempt(s) remaining.`);
    }

    // Success: Remove single-use OTP and attempt counter from Redis immediately
    await this.redisService.del(redisKey);
    await this.redisService.del(attemptsKey);

    let [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, cleanPhone))
      .limit(1);

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const defaultName = `User ${cleanPhone.slice(-4)}`;
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
   * Update authenticated user's profile (name & optional email) during/after onboarding
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SanitizedUser> {
    const [currentUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    const cleanEmail = dto.email ? dto.email.trim().toLowerCase() : null;

    if (cleanEmail && cleanEmail !== currentUser.email) {
      const [existingEmail] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);

      if (existingEmail && existingEmail.id !== userId) {
        throw new ConflictException('Email address is already registered');
      }
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        fullName: dto.fullName.trim(),
        ...(cleanEmail !== null ? { email: cleanEmail } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Helper: Generate access + refresh tokens and store refresh token hash in Redis dynamically
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

    // Parse dynamic refresh TTL from config (e.g. '7d' -> 604800, '24h' -> 86400)
    const refreshTtlSeconds = parseDurationToSeconds(refreshExpiration);
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
