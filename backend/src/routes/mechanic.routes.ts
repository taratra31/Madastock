import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { requireLiveWrite } from '../middleware/plan';
import * as mechanicController from '../controllers/mechanic.controller';

const router = Router();

router.use(authenticate, requireStoreAccess, requireLiveWrite);

router.get('/', mechanicController.listMechanics);
router.get('/:mechanicId', mechanicController.getMechanic);
router.post('/', mechanicController.createMechanic);
router.put('/:mechanicId', mechanicController.updateMechanic);
router.delete('/:mechanicId', mechanicController.deleteMechanic);

export default router;