import { prisma } from '../config/prisma';
import { getOrCreateEtherealAccount } from './emailService';
import { logger } from '../utils/logger';

export async function createSenderWithEthereal(userId: string, displayName: string): Promise<object> {
  const account = await getOrCreateEtherealAccount();

  // Upsert: if same Ethereal email already exists for this user, update displayName
  const sender = await prisma.sender.upsert({
    where: {
      userId_email: { userId, email: account.user },
    },
    update: { displayName },
    create: {
      userId,
      email: account.user,
      displayName,
      smtpHost: account.smtp.host,
      smtpPort: account.smtp.port,
      smtpUser: account.user,
      smtpPass: account.pass,
    },
  });

  logger.info({ senderId: sender.id, email: sender.email }, 'Sender created');
  return sender;
}

export async function getSendersForUser(userId: string) {
  return prisma.sender.findMany({
    where: { userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSenderById(id: string, userId: string) {
  return prisma.sender.findFirst({
    where: { id, userId },
  });
}
