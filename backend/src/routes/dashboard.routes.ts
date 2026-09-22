import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/stats', dashboardController.getStats);

export default router;