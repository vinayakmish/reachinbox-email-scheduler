import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createSenderHandler, listSendersHandler } from '../controllers/senderController';

const router = Router();

router.use(requireAuth);

router.get('/', listSendersHandler);
router.post('/', createSenderHandler);

export default router;
