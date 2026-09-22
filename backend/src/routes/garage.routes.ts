import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import { getStats } from '../controllers/garage.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/stats', getStats);

export default router;