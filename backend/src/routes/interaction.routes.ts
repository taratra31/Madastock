import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as interactionController from '../controllers/interaction.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite, requirePermission(PERMISSIONS.CRM_READ));

const needWrite = requirePermission(PERMISSIONS.CRM_WRITE);

router.get('/', interactionController.listInteractions);
router.post('/', needWrite, interactionController.createInteraction);
router.delete('/:interactionId', needWrite, interactionController.deleteInteraction);

export default router;
