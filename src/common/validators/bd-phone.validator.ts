import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export function IsBdPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBdPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} must be a valid Bangladeshi 11-digit mobile number (e.g. 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX, 013XXXXXXXX, 014XXXXXXXX)`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return BD_PHONE_REGEX.test(value.trim());
        },
      },
    });
  };
}
