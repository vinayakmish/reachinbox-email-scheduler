export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  createdAt: string;
}

export interface EmailCampaign {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  sender?: { id: string; email: string; displayName: string };
  _count?: { emailJobs: number };
}

export type JobStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RESCHEDULED';

export interface EmailJob {
  id: string;
  campaignId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: JobStatus;
  attempts: number;
  bullJobId: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; subject: string };
  sender?: { email: string; displayName: string };
}

export interface PaginatedResult<T> {
  emails: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateCampaignFormData {
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  senderId: string;
  recipientsFile: File | null;
}
