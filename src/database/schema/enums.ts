import { pgEnum } from 'drizzle-orm/pg-core';

export const clinicMemberRoleEnum = pgEnum('clinic_member_role', [
  'SUPER_ADMIN',
  'CLINIC_ADMIN',
  'DOCTOR',
  'RECEPTIONIST',
  'ASSISTANT',
  'LAB_TECH',
]);

export const dayOfWeekEnum = pgEnum('day_of_week', [
  'SAT',
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
]);

export const shiftNameEnum = pgEnum('shift_name', [
  'MORNING',
  'EVENING',
]);

export const scheduleExceptionStatusEnum = pgEnum('schedule_exception_status', [
  'CANCELLED',
  'DELAYED',
]);

export const visitTypeEnum = pgEnum('visit_type', [
  'NEW',
  'FOLLOW_UP',
  'REPORT_SHOW',
]);

export const bookingSourceEnum = pgEnum('booking_source', [
  'ONLINE',
  'WALK_IN',
  'ON_CALL',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'BOOKED',
  'PRESENT_IN_CHAMBER',
  'VITALS_DONE',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
]);

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'CONSULTATION',
  'LAB_TEST',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'UNPAID',
  'PARTIAL',
  'PAID',
  'REFUNDED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH',
  'BKASH',
  'NAGAD',
  'SSLCOMMERZ',
  'POS_CARD',
]);

export const labReportStatusEnum = pgEnum('lab_report_status', [
  'SAMPLE_COLLECTED',
  'PROCESSING',
  'READY',
  'DELIVERED',
]);
