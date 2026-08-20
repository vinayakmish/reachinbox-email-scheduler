import multer from 'multer';
import { config } from '../config';
import { AppError } from './errorHandler';
import { Request } from 'express';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSizeBytes },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback,
  ) => {
    const allowedMimeTypes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
    const allowedExtensions = ['.csv', '.txt'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      callback(null, true);
    } else {
      callback(new AppError('Only CSV and text files are allowed', 400));
    }
  },
});
