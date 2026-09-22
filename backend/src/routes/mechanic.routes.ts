import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as mechanicController from '../controllers/mechanic.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', mechanicController.listMechanics);
router.get('/:mechanicId', mechanicController.getMechanic);
router.post('/', mechanicController.createMechanic);
router.put('/:mechanicId', mechanicController.updateMechanic);
router.delete('/:mechanicId', mechanicController.deleteMechanic);

export default router;