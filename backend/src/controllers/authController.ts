import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

export function getCurrentUser(req: Request, res: Response): void {
  if (!req.user) {
    const response: ApiResponse = { success: false, error: 'Not authenticated' };
    res.status(401).json(response);
    return;
  }
  const response: ApiResponse = { success: true, data: req.user };
  res.json(response);
}

export function logout(req: Request, res: Response): void {
  const userId = req.user?.id;
  req.logout((err) => {
    if (err) {
      logger.error({ err, userId }, 'Logout error');
      const response: ApiResponse = { success: false, error: 'Logout failed' };
      res.status(500).json(response);
      return;
    }
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        logger.warn({ sessionErr }, 'Session destroy error');
      }
      res.clearCookie('connect.sid');
      logger.info({ userId }, 'User logged out');
      const response: ApiResponse = { success: true, message: 'Logged out successfully' };
      res.json(response);
    });
  });
}
