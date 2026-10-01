import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/cash.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/current', requirePermission(PERMISSIONS.CASH_READ), controller.getCurrent);
router.post('/open', requirePermission(PERMISSIONS.CASH_WRITE), controller.openSession);
router.post('/close', requirePermission(PERMISSIONS.CASH_WRITE), controller.closeSession);
router.get('/sessions', requirePermission(PERMISSIONS.CASH_READ), controller.listSessions);
router.get('/sessions/:sessionId', requirePermission(PERMISSIONS.CASH_READ), controller.getSession);
router.post('/transactions', requirePermission(PERMISSIONS.CASH_WRITE), controller.addTransaction);

export default router;
