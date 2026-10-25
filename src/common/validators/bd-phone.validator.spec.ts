import { BD_PHONE_REGEX } from './bd-phone.validator';

describe('BD_PHONE_REGEX', () => {
  const validNumbers = [
    '01712345678', // Grameenphone
    '01312345678', // Grameenphone (Skitto/New prefix)
    '01812345678', // Robi
    '01612345678', // Airtel
    '01912345678', // Banglalink
    '01412345678', // Banglalink (New prefix)
    '01512345678', // Teletalk
  ];

  const invalidNumbers = [
    '01212345678', // Invalid operator code '2'
    '01012345678', // Invalid operator code '0'
    '01112345678', // Invalid operator code '1' (CDMA Citycell defunct)
    '0171234567',  // 10 digits (too short)
    '017123456789', // 12 digits (too long)
    '+8801712345678', // Contains country code (+88 not standard 11 digits format)
    '0171234567a', // Non-numeric
    '',
    'abcdefghijk',
  ];

  it.each(validNumbers)('should validate valid BD mobile number: %s', (phone) => {
    expect(BD_PHONE_REGEX.test(phone)).toBe(true);
  });

  it.each(invalidNumbers)('should reject invalid mobile number: %s', (phone) => {
    expect(BD_PHONE_REGEX.test(phone)).toBe(false);
  });
});
