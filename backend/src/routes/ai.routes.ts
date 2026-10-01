import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as controller from '../controllers/ai.controller';

const router = Router();

router.get('/status', controller.status);

router.use(authenticate, requireStoreAccess);

router.post('/chat', requirePermission(PERMISSIONS.AI_USE), controller.chat);
router.post('/generate', requirePermission(PERMISSIONS.AI_USE), controller.generate);
router.get('/suggestions', requirePermission(PERMISSIONS.AI_USE), controller.suggestions);

export default router;
