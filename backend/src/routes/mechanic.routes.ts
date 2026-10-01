import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../lib/permissions';
import * as mechanicController from '../controllers/mechanic.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite, requirePermission(PERMISSIONS.CRM_READ));

const needWrite = requirePermission(PERMISSIONS.CRM_WRITE);

router.get('/', mechanicController.listMechanics);
router.get('/:mechanicId', mechanicController.getMechanic);
router.post('/', needWrite, mechanicController.createMechanic);
router.put('/:mechanicId', needWrite, mechanicController.updateMechanic);
router.delete('/:mechanicId', needWrite, mechanicController.deleteMechanic);

export default router;
