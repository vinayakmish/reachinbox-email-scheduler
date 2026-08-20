import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import {
  createCampaignHandler,
  listCampaignsHandler,
  getCampaignHandler,
  cancelCampaignHandler,
} from '../controllers/campaignController';

const router = Router();

router.use(requireAuth);

router.post('/', uploadMiddleware.single('recipientsFile'), createCampaignHandler);
router.get('/', listCampaignsHandler);
router.get('/:id', getCampaignHandler);
router.post('/:id/cancel', cancelCampaignHandler);

export default router;
