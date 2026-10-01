import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as controller from '../controllers/ai.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.post('/chat', controller.chat);
router.post('/generate', controller.generate);
router.get('/suggestions', controller.suggestions);

export default router;