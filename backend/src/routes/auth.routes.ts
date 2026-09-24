import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-code', authController.resendCode);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export default router;