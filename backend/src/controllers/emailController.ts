import { Request, Response, NextFunction } from 'express';
import { getScheduledEmails, getSentEmails, getEmailById } from '../services/emailJobService';
import { AppError } from '../middleware/errorHandler';

export async function getScheduledEmailsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const result = await getScheduledEmails(userId, page, limit);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getSentEmailsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
    const result = await getSentEmails(userId, page, limit);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getEmailByIdHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const email = await getEmailById(id, userId);
    if (!email) {
      throw new AppError('Email not found', 404);
    }
    res.json({ success: true, data: email });
  } catch (err) {
    next(err);
  }
}
