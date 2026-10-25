import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService, parseDurationToSeconds } from './auth.service';

describe('AuthService Remediation Tests', () => {
  let authService: AuthService;
  let mockDb: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRedisService: any;
  let mockSmsQueue: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verifyAsync: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          JWT_ACCESS_SECRET: 'access_secret_min_16_chars',
          JWT_REFRESH_SECRET: 'refresh_secret_min_16_chars',
          JWT_ACCESS_EXPIRATION_TIME: '15m',
          JWT_REFRESH_EXPIRATION_TIME: '7d',
          NODE_ENV: 'test',
        };
        return config[key] ?? defaultValue;
      }),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };

    mockSmsQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    authService = new AuthService(
      mockDb,
      mockJwtService,
      mockConfigService,
      mockRedisService,
      mockSmsQueue,
    );
  });

  describe('parseDurationToSeconds', () => {
    it('should correctly parse day strings', () => {
      expect(parseDurationToSeconds('7d')).toBe(604800);
      expect(parseDurationToSeconds('1d')).toBe(86400);
    });

    it('should correctly parse hour strings', () => {
      expect(parseDurationToSeconds('24h')).toBe(86400);
      expect(parseDurationToSeconds('1h')).toBe(3600);
    });

    it('should correctly parse minute strings', () => {
      expect(parseDurationToSeconds('15m')).toBe(900);
      expect(parseDurationToSeconds('60m')).toBe(3600);
    });

    it('should correctly parse seconds strings or numeric strings', () => {
      expect(parseDurationToSeconds('3600s')).toBe(3600);
      expect(parseDurationToSeconds('120')).toBe(120);
    });

    it('should fallback to 7 days for invalid formats', () => {
      expect(parseDurationToSeconds('invalid')).toBe(604800);
    });
  });

  describe('register - Duplicate Email Check', () => {
    it('should throw ConflictException if email is already taken', async () => {
      // First select query checks phone (not found), second checks email (found)
      mockDb.limit
        .mockResolvedValueOnce([]) // Phone check 1
        .mockResolvedValueOnce([{ id: 'existing-user-id' }]); // Email check 1

      await expect(
        authService.register({
          phone: '01712345678',
          fullName: 'Test Doctor',
          password: 'password123',
          email: 'duplicate@clinic.com',
        }),
      ).rejects.toThrow('Email address is already registered');
    });
  });

  describe('requestOtp - Cooldown (60s)', () => {
    it('should throw BadRequestException if phone is in 60s cooldown', async () => {
      mockRedisService.exists.mockResolvedValue(1); // Cooldown active

      await expect(
        authService.requestOtp({ phone: '01812345678' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        authService.requestOtp({ phone: '01812345678' }),
      ).rejects.toThrow('Please wait 60 seconds before requesting a new OTP');
    });

    it('should generate OTP and set 60s cooldown when not in cooldown', async () => {
      mockRedisService.exists.mockResolvedValue(0);

      const result = await authService.requestOtp({ phone: '01812345678' });
      expect(result.message).toContain('dispatched');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'otp_cooldown:01812345678',
        '1',
        60,
      );
      expect(mockRedisService.del).toHaveBeenCalledWith('otp_attempts:01812345678');
      expect(mockSmsQueue.add).toHaveBeenCalledWith('send-otp', expect.any(Object));
    });
  });

  describe('verifyOtp - Brute Force Protection (Max 5 attempts)', () => {
    const phone = '01812345678';
    const validOtp = '123456';

    it('should track failed attempts and show remaining count', async () => {
      mockRedisService.get.mockResolvedValue(validOtp);
      mockRedisService.incr.mockResolvedValue(2); // 2nd attempt

      await expect(
        authService.verifyOtp({ phone, otp: '999999' }),
      ).rejects.toThrow('Invalid OTP code. 3 attempt(s) remaining.');
    });

    it('should lock out, delete OTP, and throw after 5 failed attempts', async () => {
      mockRedisService.get.mockResolvedValue(validOtp);
      mockRedisService.incr.mockResolvedValue(5); // 5th attempt

      await expect(
        authService.verifyOtp({ phone, otp: '999999' }),
      ).rejects.toThrow(
        'Too many failed OTP attempts. Please request a new OTP.',
      );

      expect(mockRedisService.del).toHaveBeenCalledWith(`otp:${phone}`);
      expect(mockRedisService.del).toHaveBeenCalledWith(`otp_attempts:${phone}`);
    });

    it('should clean up OTP and attempts on successful verification', async () => {
      mockRedisService.get.mockResolvedValue(validOtp);
      mockDb.limit.mockResolvedValue([
        {
          id: 'user-patient-id',
          phone,
          fullName: 'Test Patient',
          email: null,
          isPhoneVerified: true,
          isActive: true,
          avatarR2Key: null,
        },
      ]);

      const result = await authService.verifyOtp({ phone, otp: validOtp });
      expect(result.accessToken).toBe('mock-token');
      expect(mockRedisService.del).toHaveBeenCalledWith(`otp:${phone}`);
      expect(mockRedisService.del).toHaveBeenCalledWith(`otp_attempts:${phone}`);
    });
  });
});
