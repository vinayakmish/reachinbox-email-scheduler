import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from '../config';
import { logger } from '../utils/logger';

interface SmtpCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  credentials: SmtpCredentials;
}

interface EtherealAccount {
  user: string;
  pass: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  web: string;
}

// Cache ethereal account so we don't create a new one on every call
let cachedEtherealAccount: EtherealAccount | null = null;

export async function getOrCreateEtherealAccount(): Promise<EtherealAccount> {
  // Use env-provided credentials if available
  if (config.ethereal.user && config.ethereal.pass) {
    return {
      user: config.ethereal.user,
      pass: config.ethereal.pass,
      smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
      web: 'https://ethereal.email',
    };
  }

  if (cachedEtherealAccount) {
    return cachedEtherealAccount;
  }

  logger.info('Creating new Ethereal test account...');
  const account = await nodemailer.createTestAccount();
  cachedEtherealAccount = {
    user: account.user,
    pass: account.pass,
    smtp: { host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure },
    web: account.web,
  };
  logger.info({ user: account.user, web: account.web }, 'Ethereal account created');
  return cachedEtherealAccount;
}

function createTransporter(credentials: SmtpCredentials): Transporter<SMTPTransport.SentMessageInfo> {
  const options: SMTPTransport.Options = {
    host: credentials.host,
    port: credentials.port,
    secure: credentials.port === 465,
    auth: {
      user: credentials.user,
      pass: credentials.pass,
    },
  };
  return nodemailer.createTransport(options);
}

export async function sendEmail(options: SendEmailOptions): Promise<{ info: SentMessageInfo; previewUrl: string | false }> {
  const transporter = createTransporter(options.credentials);

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  // Log preview URL for Ethereal
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info({ to: options.to, messageId: info.messageId, previewUrl }, 'Email sent via Ethereal');
  }

  return { info, previewUrl };
}

