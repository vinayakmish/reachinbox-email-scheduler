import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createSenderWithEthereal, getSendersForUser } from '../services/senderService';
import { AppError } from '../middleware/errorHandler';

const CreateSenderSchema = z.object({
  displayName: z.string().min(1).max(100),
});

export async function createSenderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = CreateSenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        data: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    const userId = req.user!.id;
    const sender = await createSenderWithEthereal(userId, parsed.data.displayName);
    res.status(201).json({ success: true, data: sender });
  } catch (err) {
    next(err);
  }
}

export async function listSendersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const senders = await getSendersForUser(userId);
    res.json({ success: true, data: senders });
  } catch (err) {
    next(err);
  }
}
