import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  const response: ApiResponse = { success: false, error: 'Authentication required' };
  res.status(401).json(response);
}
