import { JobStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getEmailQueue } from '../queues/emailQueue';
import { logger } from '../utils/logger';

export async function reconcilePendingJobs(): Promise<void> {
  try {
    // 1. Reset any stranded PROCESSING jobs back to PENDING
    const resetResult = await prisma.emailJob.updateMany({
      where: { status: JobStatus.PROCESSING },
      data: { status: JobStatus.PENDING },
    });
    if (resetResult.count > 0) {
      logger.info({ count: resetResult.count }, 'Reset stranded PROCESSING jobs to PENDING');
    }

    // 2. Find all PENDING or RESCHEDULED jobs
    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: [JobStatus.PENDING, JobStatus.RESCHEDULED] },
      },
      select: { id: true, scheduledAt: true },
    });

    if (pendingJobs.length > 0) {
      logger.info({ count: pendingJobs.length }, 'Reconciling pending jobs with BullMQ queue');
      const queue = getEmailQueue();

      for (const job of pendingJobs) {
        const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());
        const bullJobId = `email-job-${job.id}`;

        const existing = await queue.getJob(bullJobId);
        if (!existing) {
          await queue.add('send-email', { emailJobId: job.id }, { delay, jobId: bullJobId });
          logger.info({ emailJobId: job.id, delay }, 'Re-enqueued missing BullMQ job');
        } else {
          const state = await existing.getState();
          if (state === 'delayed' && delay === 0) {
            await existing.promote();
            logger.info({ emailJobId: job.id }, 'Promoted elapsed delayed job to active queue');
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error reconciling pending jobs');
  }
}
