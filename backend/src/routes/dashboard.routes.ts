import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/stats', requirePermission(PERMISSIONS.DASHBOARD_READ), dashboardController.getStats);

export default router;
