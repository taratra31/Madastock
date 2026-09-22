import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as interactionController from '../controllers/interaction.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/', interactionController.listInteractions);
router.post('/', interactionController.createInteraction);
router.delete('/:interactionId', interactionController.deleteInteraction);

export default router;