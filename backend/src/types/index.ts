import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      googleId: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    }
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface EmailJobPayload {
  emailJobId: string;
}

export interface CreateCampaignInput {
  subject: string;
  body: string;
  startTime: string; // ISO date string
  delayBetweenEmails: number; // ms
  hourlyLimit: number;
  senderId: string;
  recipients: string[];
}

export interface ParsedRecipients {
  valid: string[];
  invalid: string[];
  duplicatesRemoved: number;
}

export { User };
