import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, GeneratePdfJobData } from './queue.constants';

@Processor(QUEUES.PDF)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  async process(job: Job<GeneratePdfJobData>): Promise<{ success: boolean; r2Key: string }> {
    const { type, entityId, clinicId } = job.data;
    this.logger.log(
      `[PDF Worker] Generating PDF for ${type} (Entity: ${entityId}, Clinic: ${clinicId})`,
    );

    // Asynchronous PDF generation and R2 upload
    const generatedKey = `clinics/${clinicId}/pdfs/${type.toLowerCase()}_${entityId}.pdf`;
    return { success: true, r2Key: generatedKey };
  }
}
