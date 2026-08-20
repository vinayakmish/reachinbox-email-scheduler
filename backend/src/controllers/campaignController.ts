import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createCampaign, getCampaigns, getCampaignById, cancelCampaign } from '../services/campaignService';
import { parseRecipientsFromText } from '../utils/csvParser';
import { getSenderById } from '../services/senderService';
import { ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

const CreateCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(998),
  body: z.string().min(1, 'Body is required'),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  delayBetweenEmails: z.coerce.number().int().min(0).max(3_600_000).default(2000),
  hourlyLimit: z.coerce.number().int().min(1).max(10_000).default(200),
  senderId: z.string().min(1, 'Sender is required'),
});

export async function createCampaignHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('Recipients file is required', 400);
    }

    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        data: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const input = parsed.data;
    const userId = req.user!.id;

    // Verify sender belongs to user
    const sender = await getSenderById(input.senderId, userId);
    if (!sender) {
      throw new AppError('Sender not found', 404);
    }

    // Parse recipients
    const content = file.buffer.toString('utf-8');
    const { valid: recipients, invalid, duplicatesRemoved } = parseRecipientsFromText(content);

    if (recipients.length === 0) {
      throw new AppError('No valid email addresses found in the uploaded file', 400);
    }

    const campaign = await createCampaign(userId, {
      subject: input.subject,
      body: input.body,
      startTime: input.startTime,
      delayBetweenEmails: input.delayBetweenEmails,
      hourlyLimit: input.hourlyLimit,
      senderId: input.senderId,
      recipients,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        campaign,
        recipientsSummary: {
          valid: recipients.length,
          invalid: invalid.length,
          duplicatesRemoved,
        },
      },
      message: `Campaign scheduled with ${recipients.length} recipients`,
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

export async function listCampaignsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const campaigns = await getCampaigns(userId);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const campaign = await getCampaignById(id, userId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
}

export async function cancelCampaignHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const campaign = await cancelCampaign(id, userId);
    if (!campaign) {
      throw new AppError('Campaign not found or cannot be cancelled', 404);
    }
    res.json({ success: true, data: campaign, message: 'Campaign cancelled' });
  } catch (err) {
    next(err);
  }
}
