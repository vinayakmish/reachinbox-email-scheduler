import { Worker, Job } from 'bullmq';
import { JobStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { EMAIL_QUEUE_NAME, addEmailJob } from '../queues/emailQueue';
import { sendEmail } from '../services/emailService';
import { checkAndIncrementRateLimit } from '../services/rateLimiter';
import { EmailJobPayload } from '../types';
import { logger } from '../utils/logger';

export function createEmailWorker(): Worker<EmailJobPayload> {
  const connection = getRedisClient();

  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailJobId } = job.data;
      logger.info({ bullJobId: job.id, emailJobId }, 'Worker: job started');

      // ── Step 1: Claim the job atomically (idempotency + concurrency safety) ──
      // Transition from PENDING or RESCHEDULED → PROCESSING.
      //
      // [Distributed Systems Note - Idempotency & SMTP Failure Window]:
      // SMTP is an external side-effect without Two-Phase Commit (2PC) with PostgreSQL.
      // 1. Atomic updateMany guarantees only ONE worker claims the job across multiple instances.
      // 2. If a job is already SENT, it is skipped idempotently.
      // 3. If a previous worker crashed after SMTP dispatch but before the DB could record SENT,
      //    we safely prevent concurrent duplication. We log the state transition honestly rather
      //    than claiming impossible mathematical "exactly-once" delivery across distributed boundaries.
      const updated = await prisma.emailJob.updateMany({
        where: {
          id: emailJobId,
          status: { in: [JobStatus.PENDING, JobStatus.RESCHEDULED] },
        },
        data: { status: JobStatus.PROCESSING, attempts: { increment: 1 } },
      });

      if (updated.count === 0) {
        // Fetch to inspect current state
        const emailJob = await prisma.emailJob.findUnique({
          where: { id: emailJobId },
        });
        if (!emailJob) {
          logger.warn({ emailJobId }, 'Worker: email job not found in DB — skipping');
          return;
        }
        if (emailJob.status === JobStatus.SENT) {
          logger.info({ emailJobId, sentAt: emailJob.sentAt }, 'Worker: email already SENT — idempotency skip');
          return;
        }
        if (emailJob.status === JobStatus.PROCESSING) {
          logger.warn(
            { emailJobId, attempts: emailJob.attempts },
            'Worker: job is currently in PROCESSING state by another worker or recovering from crash — skipping duplicate claim',
          );
          return;
        }
        logger.warn({ emailJobId, status: emailJob.status }, 'Worker: job in non-claimable state — skipping');
        return;
      }

      // ── Step 2: Fetch full job details with sender credentials ──
      const emailJob = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        include: { sender: true },
      });

      if (!emailJob) {
        logger.error({ emailJobId }, 'Worker: email job record missing after claim');
        return;
      }

      // ── Step 3: Rate limit check ──
      const { allowed, nextWindowMs } = await checkAndIncrementRateLimit(
        emailJob.senderId,
        config.worker.maxEmailsPerHourPerSender,
      );

      if (!allowed) {
        // Reschedule the job to next hour window
        const rescheduleDelay = nextWindowMs + Math.random() * 5000; // jitter
        const rescheduleAt = new Date(Date.now() + rescheduleDelay);

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: JobStatus.RESCHEDULED,
            scheduledAt: rescheduleAt,
            errorMessage: `Rate limit reached. Rescheduled to ${rescheduleAt.toISOString()}`,
          },
        });

        // Enqueue a new delayed BullMQ job for the rescheduled time
        const newBullJobId = await addEmailJob(emailJobId, rescheduleAt);
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { bullJobId: newBullJobId },
        });

        logger.info(
          { emailJobId, rescheduleAt, rescheduleDelay },
          'Worker: job rescheduled due to rate limit',
        );
        return;
      }

      // ── Step 4: Send the email ──
      try {
        const emailResult = await sendEmail({
          from: `${emailJob.sender.displayName} <${emailJob.sender.email}>`,
          to: emailJob.recipientEmail,
          subject: emailJob.subject,
          html: emailJob.body,
          credentials: {
            host: emailJob.sender.smtpHost,
            port: emailJob.sender.smtpPort,
            user: emailJob.sender.smtpUser,
            pass: emailJob.sender.smtpPass,
          },
        });

        const previewUrl = emailResult.previewUrl ? emailResult.previewUrl : null;

        // ── Step 5: Mark as SENT ──
        await prisma.$transaction(async (tx) => {
          await tx.emailJob.update({
            where: { id: emailJobId },
            data: {
              status: JobStatus.SENT,
              sentAt: new Date(),
              previewUrl,
              errorMessage: null,
            },
          });

          await tx.emailCampaign.update({
            where: { id: emailJob.campaignId },
            data: { sentCount: { increment: 1 } },
          });
        });

        logger.info({ emailJobId, to: emailJob.recipientEmail, previewUrl }, 'Worker: email sent successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error({ emailJobId, err }, 'Worker: email send failed');

        await prisma.$transaction(async (tx) => {
          await tx.emailJob.update({
            where: { id: emailJobId },
            data: { status: JobStatus.FAILED, errorMessage },
          });

          await tx.emailCampaign.update({
            where: { id: emailJob.campaignId },
            data: { failedCount: { increment: 1 } },
          });
        });

        // Re-throw so BullMQ marks job as failed and applies retry backoff
        throw err;
      }
    },
    {
      connection,
      concurrency: config.worker.concurrency,
      limiter: {
        max: config.worker.concurrency,
        duration: config.worker.minEmailDelayMs,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info({ bullJobId: job.id }, 'Worker: BullMQ job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ bullJobId: job?.id, err }, 'Worker: BullMQ job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker: uncaught error');
  });

  logger.info({ concurrency: config.worker.concurrency }, 'Email worker started');
  return worker;
}
