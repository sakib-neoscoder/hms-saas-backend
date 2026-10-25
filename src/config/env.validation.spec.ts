import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validConfig = {
    PORT: '8000',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://clinic_user:clinic_password@localhost:5432/hms_master_db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    JWT_ACCESS_SECRET: 'super_secret_access_token_min_16_chars_bd_clinic',
    JWT_REFRESH_SECRET: 'super_secret_refresh_token_min_16_chars_bd_clinic',
    JWT_ACCESS_EXPIRATION_TIME: '15m',
    JWT_REFRESH_EXPIRATION_TIME: '7d',
    R2_ACCOUNT_ID: 'cf_account_123',
    R2_ACCESS_KEY_ID: 'cf_key_123',
    R2_SECRET_ACCESS_KEY: 'cf_secret_123',
    R2_BUCKET_NAME: 'clinic-bucket',
  };

  it('should successfully parse and coerce valid config', () => {
    const parsed = validateEnv(validConfig);
    expect(parsed.PORT).toBe(8000);
    expect(parsed.REDIS_PORT).toBe(6379);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.DATABASE_URL).toBe(validConfig.DATABASE_URL);
  });

  it('should throw Error when mandatory variables are missing', () => {
    const invalidConfig = { ...validConfig, DATABASE_URL: '' };
    expect(() => validateEnv(invalidConfig)).toThrow('Environment validation failed');
  });

  it('should throw Error when JWT secret is shorter than 16 chars', () => {
    const invalidConfig = { ...validConfig, JWT_ACCESS_SECRET: 'short' };
    expect(() => validateEnv(invalidConfig)).toThrow('Environment validation failed');
  });
});
