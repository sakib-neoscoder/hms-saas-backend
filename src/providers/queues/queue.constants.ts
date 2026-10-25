export const QUEUES = {
  SMS: 'sms-queue',
  PDF: 'pdf-queue',
} as const;

export interface SendSmsJobData {
  phone: string;
  message: string;
  clinicId?: string;
  senderId?: string;
}

export interface GeneratePdfJobData {
  type: 'PRESCRIPTION' | 'INVOICE' | 'LAB_REPORT';
  entityId: string;
  clinicId: string;
}
