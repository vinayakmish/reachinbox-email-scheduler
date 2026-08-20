import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getScheduledEmailsHandler,
  getSentEmailsHandler,
  getEmailByIdHandler,
} from '../controllers/emailController';

const router = Router();

router.use(requireAuth);

router.get('/scheduled', getScheduledEmailsHandler);
router.get('/sent', getSentEmailsHandler);
router.get('/:id', getEmailByIdHandler);

export default router;
