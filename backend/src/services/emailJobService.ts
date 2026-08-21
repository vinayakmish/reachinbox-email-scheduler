import { JobStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

export async function getScheduledEmails(
  userId: string,
  page = 1,
  limit = 20,
) {
  const skip = (page - 1) * limit;

  const [emails, total] = await Promise.all([
    prisma.emailJob.findMany({
      where: {
        campaign: { userId },
        status: { in: [JobStatus.PENDING, JobStatus.RESCHEDULED, JobStatus.PROCESSING] },
      },
      include: {
        campaign: { select: { id: true, subject: true } },
        sender: { select: { email: true, displayName: true, smtpHost: true, smtpPort: true, smtpUser: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: { in: [JobStatus.PENDING, JobStatus.RESCHEDULED, JobStatus.PROCESSING] },
      },
    }),
  ]);

  return { emails, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSentEmails(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [emails, total, sentCount, failedCount] = await Promise.all([
    prisma.emailJob.findMany({
      where: {
        campaign: { userId },
        status: { in: [JobStatus.SENT, JobStatus.FAILED] },
      },
      include: {
        campaign: { select: { id: true, subject: true } },
        sender: { select: { email: true, displayName: true, smtpHost: true, smtpPort: true, smtpUser: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: { in: [JobStatus.SENT, JobStatus.FAILED] },
      },
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: JobStatus.SENT,
      },
    }),
    prisma.emailJob.count({
      where: {
        campaign: { userId },
        status: JobStatus.FAILED,
      },
    }),
  ]);

  return { emails, total, sentCount, failedCount, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getEmailById(id: string, userId: string) {
  return prisma.emailJob.findFirst({
    where: { id, campaign: { userId } },
    include: {
      campaign: { select: { id: true, subject: true } },
      sender: { select: { email: true, displayName: true, smtpHost: true, smtpPort: true, smtpUser: true } },
    },
  });
}
