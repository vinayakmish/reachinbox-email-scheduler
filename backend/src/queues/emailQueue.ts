import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { EmailJobPayload } from '../types';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'email-sending';

let emailQueue: Queue<EmailJobPayload> | null = null;

export function getEmailQueue(): Queue<EmailJobPayload> {
  if (!emailQueue) {
    const connection = getRedisClient();
    const queueOptions: QueueOptions = {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
        removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    };
    emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, queueOptions);
    logger.info('Email queue initialized');
  }
  return emailQueue;
}

export async function addEmailJob(
  emailJobId: string,
  scheduledAt: Date,
): Promise<string> {
  const queue = getEmailQueue();
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  const job = await queue.add(
    'send-email',
    { emailJobId },
    {
      delay,
      jobId: `email-job-${emailJobId}`, // Stable job ID for deduplication
    },
  );

  logger.info(
    { bullJobId: job.id, emailJobId, delay, scheduledAt },
    'BullMQ job enqueued',
  );

  return job.id!;
}

export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
