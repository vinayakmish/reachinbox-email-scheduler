import { prisma } from '../config/prisma';
import { addEmailJob } from '../queues/emailQueue';
import { CreateCampaignInput } from '../types';
import { logger } from '../utils/logger';
import { CampaignStatus } from '@prisma/client';

export async function createCampaign(
  userId: string,
  input: CreateCampaignInput,
) {
  const startTime = new Date(input.startTime);

  // Create campaign record
  const campaign = await prisma.emailCampaign.create({
    data: {
      userId,
      senderId: input.senderId,
      subject: input.subject,
      body: input.body,
      startTime,
      delayBetweenEmails: input.delayBetweenEmails,
      hourlyLimit: input.hourlyLimit,
      status: CampaignStatus.SCHEDULED,
      totalRecipients: input.recipients.length,
    },
  });

  logger.info(
    { campaignId: campaign.id, totalRecipients: input.recipients.length },
    'Campaign created',
  );

  // Create email jobs and enqueue BullMQ delayed jobs
  const emailJobsData = input.recipients.map((email, index) => {
    const scheduledAt = new Date(
      startTime.getTime() + index * input.delayBetweenEmails,
    );
    return {
      campaignId: campaign.id,
      senderId: input.senderId,
      recipientEmail: email,
      subject: input.subject,
      body: input.body,
      scheduledAt,
      idempotencyKey: `campaign:${campaign.id}:recipient:${email}:index:${index}`,
    };
  });

  // Batch insert email jobs (chunked to avoid query limits)
  const CHUNK_SIZE = 500;
  const createdJobs: { id: string; scheduledAt: Date }[] = [];

  for (let i = 0; i < emailJobsData.length; i += CHUNK_SIZE) {
    const chunk = emailJobsData.slice(i, i + CHUNK_SIZE);
    // Use createMany for efficiency
    await prisma.emailJob.createMany({
      data: chunk,
      skipDuplicates: true, // Skip any duplicate idempotencyKey
    });

    // Fetch created job IDs to enqueue in BullMQ
    const ids = await prisma.emailJob.findMany({
      where: {
        campaignId: campaign.id,
        idempotencyKey: { in: chunk.map((j) => j.idempotencyKey) },
      },
      select: { id: true, scheduledAt: true },
    });
    createdJobs.push(...ids);
  }

  // Enqueue BullMQ delayed jobs and save bullJobId
  logger.info({ campaignId: campaign.id, count: createdJobs.length }, 'Enqueuing BullMQ jobs');

  const updatePromises = createdJobs.map(async (job) => {
    try {
      const bullJobId = await addEmailJob(job.id, job.scheduledAt);
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullJobId },
      });
    } catch (err) {
      logger.error({ emailJobId: job.id, err }, 'Failed to enqueue BullMQ job');
    }
  });

  // Process in batches to avoid overwhelming Redis
  const ENQUEUE_CHUNK = 100;
  for (let i = 0; i < updatePromises.length; i += ENQUEUE_CHUNK) {
    await Promise.all(updatePromises.slice(i, i + ENQUEUE_CHUNK));
  }

  logger.info({ campaignId: campaign.id }, 'All BullMQ jobs enqueued');

  return campaign;
}

export async function getCampaigns(userId: string) {
  return prisma.emailCampaign.findMany({
    where: { userId },
    include: {
      sender: {
        select: { id: true, email: true, displayName: true },
      },
      _count: { select: { emailJobs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCampaignById(id: string, userId: string) {
  return prisma.emailCampaign.findFirst({
    where: { id, userId },
    include: {
      sender: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });
}

export async function cancelCampaign(id: string, userId: string) {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id, userId, status: { in: [CampaignStatus.SCHEDULED, CampaignStatus.RUNNING] } },
  });

  if (!campaign) {
    return null;
  }

  return prisma.emailCampaign.update({
    where: { id },
    data: { status: CampaignStatus.CANCELLED },
  });
}
