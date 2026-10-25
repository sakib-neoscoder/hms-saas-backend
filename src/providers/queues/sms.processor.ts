import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, SendSmsJobData } from './queue.constants';

@Processor(QUEUES.SMS)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  async process(job: Job<SendSmsJobData>): Promise<{ sent: boolean; messageId: string }> {
    const { phone, message, senderId, clinicId } = job.data;
    this.logger.log(
      `[SMS Worker] Dispatching SMS to ${phone} via sender "${senderId || 'DEFAULT'}" (Clinic: ${clinicId || 'SYSTEM'}): "${message}"`,
    );

    // Simulated SMS gateway HTTP dispatch (e.g. Greenweb, SSL Wireless, or Infobip)
    const simulatedMessageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return { sent: true, messageId: simulatedMessageId };
  }
}
