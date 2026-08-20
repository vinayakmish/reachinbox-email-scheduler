import { Router } from 'express';
import passport from 'passport';
import { getCurrentUser, logout } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// Initiate Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${config.frontendUrl}/login?error=oauth_failed` }),
  (req, res) => {
    logger.info({ userId: req.user?.id }, 'OAuth callback success — redirecting to dashboard');
    res.redirect(`${config.frontendUrl}/dashboard`);
  },
);

// Get current user
router.get('/me', requireAuth, getCurrentUser);

// Logout
router.post('/logout', requireAuth, logout);

export default router;
