import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireStoreAccess } from '../middleware/store';
import * as controller from '../controllers/cash.controller';

const router = Router();

router.use(authenticate, requireStoreAccess);

router.get('/current', controller.getCurrent);
router.post('/open', controller.openSession);
router.post('/close', controller.closeSession);
router.get('/sessions', controller.listSessions);
router.get('/sessions/:sessionId', controller.getSession);
router.post('/transactions', controller.addTransaction);

export default router;
